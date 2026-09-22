# Flexiple · AI recruiter sourcing loop

A single-search sourcing desk. A recruiter types a brief the way they would type a Google query. The product turns that sentence into **objective filters** and a **subjective fit rubric**, applies the filters to a local talent map, scores the survivors with a real LLM, then lets the recruiter argue with the shortlist until they freeze the search.

This document is for engineers shipping or reviewing the loop, and for PMs who need to know what is in scope, what we deliberately cut, and what “good” looks like in the UI.

---

## Contents

1. [Product in one page](#product-in-one-page)
2. [Scope](#scope)
3. [User journey](#user-journey)
4. [How a search actually runs](#how-a-search-actually-runs)
5. [Architecture](#architecture)
6. [APIs](#apis)
7. [Domain model](#domain-model)
8. [Repository map](#repository-map)
9. [Setup and configuration](#setup-and-configuration)
10. [Design considerations](#design-considerations)
11. [Tradeoffs](#tradeoffs)
12. [Security, reliability, observability](#security-reliability-observability)
13. [Prompts and LLM contract](#prompts-and-llm-contract)
14. [Demo / Loom](#demo--loom)
15. [Future scope](#future-scope)
16. [Known limitations](#known-limitations)

---

## Product in one page

**Job to be done.** A recruiter has a fuzzy brief (“RDS developers with 4–7 years who have worked at startups, Bangalore”). They need a *search definition* they trust: hard filters they can defend, a rubric that captures taste, and a shortlist whose “why” cites real profile fields.

**What this slice ships.** One session, one recruiter, one 48-person sample talent map. No login, no 98M-person index, no persistence across server restarts. The loop is the product.

**What “good” feels like.**

- Filters and rubric are readable at a glance and editable without another parse.
- Each card explains the match using *this* person’s skills, years, company, or summary — not generic praise.
- Feedback visibly changes the spec. The UI says what moved and why.
- Empty, slow, and failed model calls are designed states, not crashes.

**Stack.** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Zod · OpenAI-compatible Chat Completions. One process, one `npm run dev`.

---

## Scope

### In

| Area | What we built |
|---|---|
| Parse | Free text → structured filters + rubric via a real LLM |
| Filter | Deterministic match against `data/profiles.json` (48 fictional profiles) |
| Score | LLM ranks survivors against the rubric, with field-level evidence |
| Refine | Chat and/or per-profile yes/no → smallest spec change → re-run |
| Edit | Recruiter can edit filters/rubric directly and re-run |
| Freeze | Locked filters, rubric, and ranked shortlist |
| States | First load, thinking, empty shortlist, LLM failure + retry, recovery, frozen summary |

### Out (on purpose)

- Auth, roles, multi-tenant, multiple concurrent searches in the UI
- Persistence across process restarts or a real 98M-person store
- Streaming tokens, email, outreach, ATS write-back
- Recruiter accounts, saved searches, analytics dashboards

The assignment asked for quality of the loop, not surface area. Persistence and identity would have stolen time from explanations, empty states, and failure handling.

---

## User journey

```
Landing          Workspace                         Frozen
───────          ─────────                         ──────
One textarea  →  Filters + rubric always visible
Example chips    Top 5 scored cards                Final filters
                 Yes / No on each card             Final rubric
                 Chat: “1 is too junior…”          Full ranked list
                 “What changed” diff
                 [Freeze search]
```

1. Recruiter lands on a single brief field. The Bangalore RDS example is prefilled.
2. Submit shows staged thinking copy (“Reading the brief… Drafting filters…”).
3. Workspace: left = editable spec, centre = shortlist, right = feedback.
4. They vote, type, or both. The app restates the spec change, then replaces the five.
5. Empty filters never reach the scorer. The empty state offers concrete relaxations.
6. Freeze is a full-page summary, not a modal.

If the model returns unusable JSON, the server retries a repair pass. If that works, a recovery note appears. If the provider is down or the key is wrong, the previous shortlist stays and **Retry** is offered.

---

## How a search actually runs

```
Recruiter brief
      |
      v
  LLM parse  -- Zod validate / repair -->  filters + rubric
                                              |
                                              v
                                       local filter
                                    (data/profiles.json)
                                              |
                    0 matches ----------------+---------------- N matches
                    empty hints               |
                                              v
                                       heuristic pre-rank
                                       (cap SCORE_CAP = 16)
                                              |
                                              v
                                         LLM score
                                   (quotes real fields)
                                              |
                                              v
                                       show page of 5
                                              |
                     votes / chat / manual edit
                                              |
                                              v
                              LLM refine (smallest change)
                                              |
                                       loop until Freeze
```

Two LLM calls on first search (parse, then score). Each refine is refine + score. Manual edits skip parse/refine and only re-filter + re-score.

---

## Architecture

One Next.js app. Route handlers are adapters. Business logic lives in `src/server`. Shared types and the deterministic filter engine live in `src/lib` so the UI can highlight skill matches without importing Node APIs.

```
Browser
  SourcingApp  --fetch-->  /api/sessions*
                                │
                                ▼
                       http/handler.ts
                       request id · rate limit · body cap
                       shutdown guard · logs · errors
                                │
                                ▼
                         controllers
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        SearchService     FilterService      LlmService
              │                 │                 │
              ▼                 ▼                 ▼
        SessionRepo       ProfileRepo       job queue
        (memory + TTL)    (JSON file)       circuit breaker
```

| Layer | Responsibility |
|---|---|
| `src/app/api/*` | HTTP verbs only. No business rules. |
| `handler` | Cross-cutting: request id, rate limit, body size, ALS context, error envelope. |
| Controllers | Parse params/body, call a service, return a DTO. |
| Services | The loop: start, edit, refine, freeze, execute a round. |
| Repositories | Load profiles; store sessions. Swap later without touching HTTP. |
| Serializers | Domain session → public session. Full ranked list only after freeze. |
| `src/lib` | Types, Zod request schemas, filter math, prompts, sanitise. Used by UI and server. |

**Composition root.** `src/server/container.ts` constructs the graph once. `src/instrumentation.ts` boots config, shutdown hooks, and the talent map on process start.

**Concurrency.** A per-session mutex serialises refine / patch / freeze on the same id. A bounded job queue (`LLM_CONCURRENCY`, `LLM_QUEUE_SIZE`) is the only way to the model. Overflow returns `503 unavailable`.

---

## APIs

REST, JSON in and out, no cookies. `Cache-Control: no-store`. Every response includes `X-Request-Id`.

### Session

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/sessions` | Create from a brief. **201** `{ session }` |
| `GET` | `/api/sessions/:id` | Current session. `:id` must be a UUID |
| `PATCH` | `/api/sessions/:id` | Replace filters + rubric, re-run |
| `POST` | `/api/sessions/:id/refine` | Feedback → new spec → re-run |
| `POST` | `/api/sessions/:id/freeze` | Lock the search. **409** if already frozen |

`POST /api/sessions` accepts `Idempotency-Key`. A retry with the same key returns the original session for `IDEMPOTENCY_TTL_MS` (default 10 minutes).

#### Create

```http
POST /api/sessions
Content-Type: application/json

{ "query": "RDS developers with 4-7 years … Bangalore." }
```

`query`: 8–800 characters after trim.

#### Refine

```http
POST /api/sessions/{id}/refine
Content-Type: application/json

{
  "message": "1 is too junior, 2 and 4 are right",
  "votes": [{ "profileId": "p03", "match": false }]
}
```

At least one of `message` or `votes` is required. Votes that are not on the current page are dropped.

#### Patch

```http
PATCH /api/sessions/{id}
Content-Type: application/json

{ "filters": { ... }, "rubric": { ... } }
```

Same shape the LLM emits. See [Domain model](#domain-model).

### Ops

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness. `{ ok, status, llmConfigured }` |
| `GET` | `/api/ready` | Ready if not draining, key+model set, circuit not open. **503** otherwise |
| `GET` | `/api/metrics` | In-process counters (latency, LLM, cache, queue, sessions). No secrets |

`/api/metrics` is unauthenticated because this assignment has no login. Do not expose it on a public host without a gate.

### Error envelope

```json
{
  "error": {
    "code": "validation",
    "message": "Describe the role in a bit more detail.",
    "retryable": false,
    "request_id": "…"
  }
}
```

| Code | HTTP | Retry? | Typical cause |
|---|---|---|---|
| `validation` | 400 | no | Short brief, invalid UUID, empty refine |
| `payload_too_large` | 413 | no | Body over `MAX_BODY_BYTES` |
| `not_found` | 404 | no | Unknown or expired session |
| `conflict` | 409 | no | Mutating a frozen search |
| `rate_limit` | 429 | yes | Per-IP token bucket; `Retry-After` |
| `timeout` | 502 | yes | Model exceeded `LLM_TIMEOUT_MS` |
| `malformed` | 502 | yes | JSON that failed Zod even after repair |
| `provider` | 502 | yes | Upstream 4xx/5xx (except auth) |
| `config` | 503 | no | Missing or rejected API key |
| `unavailable` | 503 | yes | Shutdown, open circuit, or full LLM queue |
| `internal` | 500 | yes | Unexpected throw; stack logged, not returned |

### Session payload (success)

Active searches return `page` (up to 5) and `ranked: null`. After freeze, `ranked` is the full scored list.

```
{
  id, status, query, round,
  filters, rubric,
  messages, changeSummary, changes, recovery,
  page, pageSize, totalRanked, filteredCount, poolSize,
  emptyHints, frozenAt, ranked
}
```

Rate limits (defaults): 8 req/min/IP on LLM routes (`POST` session, `PATCH`, `refine`); 60 req/min/IP on reads. Health/ready are not limited.

---

## Domain model

**Profile** — assignment shape: `id`, `name`, `current_title`, `years_experience`, `location`, `current_company`, `current_company_type`, `skills`, `past_companies[]`, `education`, `summary`. `company_type` is `startup | scaleup | enterprise | agency`.

**Filters** (hard, local)

| Field | Meaning |
|---|---|
| `skills` | Resume-style names. Fuzzy + aliases (`RDS` ↔ `AWS RDS`; `rds` will not match `Redis`) |
| `skill_mode` | `any` (default) or `all` |
| `min_years` / `max_years` | Inclusive, or `null` |
| `locations` | Bangalore ≡ Bengaluru; Delhi NCR aliases; empty = any |
| `company_types` | Empty = any |
| `company_type_scope` | `current` or `any_history` (past startups count) |
| `title_keywords` | Substring match on `current_title` |

**Rubric** (soft, LLM) — `must_haves[]`, `criteria[{ id, name, description, weight 1–5 }]`, `nice_to_haves[]`.

**Ranked profile** — `{ profile, score 0–100, explanation, evidence[{ field, quote, why }] }`.

Sessions live in memory with TTL from last activity / freeze (`SESSION_TTL_MS`, default 2 hours). A process restart wipes them.

---

## Repository map

```
flexiple/
├── data/profiles.json          48 fictional candidates (the whole talent map)
├── src/
│   ├── instrumentation.ts      Process boot: config, shutdown, preload profiles
│   ├── app/                    Next.js routes + shell
│   │   ├── layout.tsx          Fonts, metadata
│   │   ├── page.tsx            Mounts <SourcingApp />
│   │   ├── globals.css         Theme tokens (paper, ink, copper)
│   │   └── api/                Thin HTTP adapters
│   ├── components/             Recruiter UI (client)
│   ├── lib/                    Shared domain (safe for client + server)
│   └── server/                 Node-only backend
├── .env.example
└── README.md
```

### `src/app/api`

| Path | File |
|---|---|
| `POST /api/sessions` | `sessions/route.ts` |
| `GET/PATCH /api/sessions/:id` | `sessions/[id]/route.ts` |
| `POST …/refine` | `sessions/[id]/refine/route.ts` |
| `POST …/freeze` | `sessions/[id]/freeze/route.ts` |
| `GET /api/health` | `health/route.ts` |
| `GET /api/ready` | `ready/route.ts` |
| `GET /api/metrics` | `metrics/route.ts` |

### `src/server`

| File / folder | What it does |
|---|---|
| `config.ts` | Zod-validated env. Single `getConfig()`. |
| `container.ts` | Wires repos, services, controllers. `boot()`. |
| `errors.ts` | `AppError` + HTTP mapping. |
| `context.ts` | `AsyncLocalStorage` for `request_id`. |
| `logger.ts` | JSON logs; redacts key/token/authorization. |
| `metrics.ts` | Counters, in-flight, latency p50/p95. |
| `shutdown.ts` | SIGTERM drain of in-flight requests. |
| `concurrency.ts` | Keyed mutex + semaphore. |
| `cache.ts` | TTL cache (filter results, idempotency). |
| `circuit-breaker.ts` | Closed / open / half-open around the model. |
| `jobs.ts` | Bounded LLM queue. |
| `http/handler.ts` | The middleware pipeline. |
| `http/body.ts` | JSON parse + size limit. |
| `http/rateLimit.ts` | Per-IP token bucket. |
| `controllers/` | Session + health HTTP in/out. |
| `services/search.service.ts` | The loop. |
| `services/filter.service.ts` | Cached deterministic filter. |
| `services/llm.service.ts` | Queue + circuit around parse/score/refine. |
| `repositories/` | Profiles from disk; sessions in a `Map`. |
| `serializers/session.serializer.ts` | Domain → public DTO. |
| `llm/client.ts` | Chat Completions, JSON schema, repair, retries. |

### `src/lib`

| File | What it does |
|---|---|
| `types.ts` | Shared TypeScript types. |
| `schemas.ts` | Zod for LLM output and HTTP bodies. |
| `filter.ts` | Pure matchers (also used to highlight skills in the UI). |
| `diff.ts` | Deterministic before/after if the model’s change list is thin. |
| `sanitize.ts` | Control-char strip + untrusted wrappers for prompts. |
| `api.ts` | Browser fetch wrapper + `ApiError`. |
| `errors.ts` | Re-export of `AppError`. |
| `llm/prompts.ts` | **Evaluated prompts.** Parse, score, refine, repair. |
| `llm/json-schemas.ts` | JSON Schema sent to the model. |
| `llm/generate.ts` / `score.ts` / `refine.ts` | Prompt assembly only. |

### `src/components`

| File | What it does |
|---|---|
| `SourcingApp.tsx` | Client state machine: landing → workspace → frozen. |
| `SearchLanding.tsx` | Brief + examples + missing-key hint. |
| `Workspace.tsx` | Three-column desk + recovery/error banners. |
| `SpecPanel.tsx` | Editable filters and rubric. |
| `ProfileCard.tsx` | Rank, evidence quotes, Match / Not a match. |
| `ChatPanel.tsx` | Transcript, change diff, send. |
| `EmptyResults.tsx` | Zero-filter state + one-click relaxations. |
| `FrozenView.tsx` | Locked summary. |
| `ThinkingSteps.tsx` | Staged “working the map” copy. |
| `TagInput.tsx` | Chip editor. |

---

## Setup and configuration

```bash
cp .env.example .env.local
# set OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run typecheck
npm run lint
npm run build && npm start   # production
```

The server speaks any OpenAI-compatible Chat Completions host (OpenAI, Groq, OpenRouter, Azure-compatible gateways). Keys are read only on the server. Never commit `.env.local`.

| Variable | Required | Default | Role |
|---|---|---|---|
| `OPENAI_API_KEY` | yes at runtime | — | Bearer token |
| `OPENAI_MODEL` | yes at runtime | — | Model id |
| `OPENAI_BASE_URL` | no | `https://api.openai.com/v1` | Host; `/chat/completions` is appended |
| `LOG_LEVEL` | no | `info` | `debug` \| `info` \| `warn` \| `error` |
| `LLM_TIMEOUT_MS` | no | `45000` | Per model HTTP call |
| `LLM_MAX_RETRIES` | no | `2` | Transient 429 / timeout / provider |
| `LLM_CONCURRENCY` | no | `2` | Parallel model calls |
| `LLM_QUEUE_SIZE` | no | `24` | Waiting callers before 503 |
| `RATE_LIMIT_LLM_PER_MIN` | no | `8` | Write/LLM routes |
| `RATE_LIMIT_READ_PER_MIN` | no | `60` | GET session / metrics |
| `SESSION_TTL_MS` | no | `7200000` | In-memory session lifetime |
| `MAX_BODY_BYTES` | no | `32768` | JSON body cap |
| `PAGE_SIZE` | no | `5` | Cards shown per round |
| `SCORE_CAP` | no | `16` | Max profiles sent to the scorer |
| `CIRCUIT_FAILURE_THRESHOLD` | no | `5` | Failures before the circuit opens |
| `CIRCUIT_COOLDOWN_MS` | no | `30000` | Open → half-open |
| `SHUTDOWN_DRAIN_MS` | no | `15000` | Wait for in-flight on SIGTERM |
| `FILTER_CACHE_TTL_MS` | no | `60000` | Cached filter id lists |
| `IDEMPOTENCY_TTL_MS` | no | `600000` | Create-session idempotency |

Invalid numbers or enums fail at `getConfig()` with a path-specific message.

---

## Design considerations

**Filters vs rubric.** Years, location, skills, and company type can be applied without a model. Taste (“feels like early-stage payments”) cannot. Mixing them produces either empty sets or unverifiable scores. The parser is instructed: when unsure, omit the filter and put the preference in the rubric.

**Recall over precision on parse.** A zero-result first search is a product failure. Empty state then offers *named* relaxations (drop location, match any skill, count past company types). Those are computed from the current filters, not guessed by the model.

**Trust is the explanation.** Scores without quotes train recruiters to ignore the product. The scorer must copy a real field value. The card renders `field · “quote” — why`.

**The spec stays on screen.** Chat is one input, not the source of truth. Recruiters edit chips and criteria, then apply. That is faster and more honest than hoping the model heard “a bit more senior”.

**Designed waiting.** Two sequential model calls already take several seconds. Time-based step copy is honest. A token stream would add complexity without changing the fact that results arrive together.

**Smallest refine.** The refine prompt is told to raise `min_years` when someone is “too junior”, not rewrite the search. The UI shows a before/after diff so the recruiter can see the product listened.

**Page of five, full list on freeze.** During the loop we only show a handful so feedback stays concrete (“1 and 4”). Freeze is the shortlist artefact.

---

## Tradeoffs

| We chose | Over | Why |
|---|---|---|
| Next.js route handlers in one repo | Separate Express/Fastify + Vite | Assignment: run in one or two commands. Layers still exist; HTTP is just an adapter. |
| OpenAI-compatible `fetch` client | Vendor SDK | `OPENAI_BASE_URL` swaps Groq / OpenRouter / OpenAI without a new dependency. Timeouts via `AbortSignal`. |
| In-memory sessions | Postgres / Redis | Brief forbids persistence across sessions. TTL + mutex is enough for one desk. Restart = new world. |
| Filter then score, cap 16 | Score all 48 every time | Filters are free and explainable. Scoring 48 narratives is slow and expensive. Heuristic pre-rank is the tie-break. |
| JSON Schema + Zod + one repair | Trust the model | Rendered objects must be valid or the UI lies. Repair is cheaper than a recruiter-facing crash. |
| In-process queue + circuit | Redis + Bull + Redis circuit | Same process, no extra infra. The *shape* is swappable; the assignment is not a platform. |
| Staged thinking, not streaming | SSE token UI | Results are structured blobs, not prose. Streaming JSON is noisy; the wait is the model, not the renderer. |
| No auth | NextAuth / cookies | Out of scope. Rate limit is IP-based. Metrics stay private by deployment, not by product. |
| Editorial light UI | Dark “AI demo” chrome | Recruiters read. Paper, serif names, copper accent. The shortlist is the hero, not the model. |

**Why a real LLM, not fixtures.** The assignment *is* the loop with a live model. Failure handling (429, timeout, malformed JSON, bad key) is part of the UX, not a test double.

**Why not a 98M index.** There is no such database in the brief. The interesting difficulty is refinement against a mix of obvious matches, near-misses, and clear non-matches — which the 48-row file is built for.

---

## Security, reliability, observability

**Security**

- API key never sent to the browser.
- Recruiter text is stripped of control characters and wrapped in delimiters; the refine system prompt treats it as data.
- Body size cap; UUID session ids; Zod on every write.
- Security headers: `nosniff`, `DENY` framing, referrer policy, restrictive CSP, `poweredByHeader: false`.
- Logs redact `authorization`, `api_key`, `token`, `secret`, `password`.

**Reliability**

- Timeouts, bounded retries with backoff, JSON repair, circuit breaker, queue overflow → 503.
- Per-session lock prevents lost updates if the recruiter double-submits.
- SIGTERM: stop accepting new LLM work, drain in-flight up to `SHUTDOWN_DRAIN_MS`.
- `/api/ready` is what a load balancer should hit, not `/api/health` alone.

**Observability**

- JSON access and error logs with `request_id`, route, status, duration. Brief text is not logged.
- `/api/metrics`: request counts, LLM calls/errors/recoveries, cache hits, job rejections, in-flight, p50/p95.
- Recovery banner when a repair pass saved a round — useful in a walkthrough.

---

## Prompts and LLM contract

All instructions: [`src/lib/llm/prompts.ts`](src/lib/llm/prompts.ts).  
JSON Schema: [`src/lib/llm/json-schemas.ts`](src/lib/llm/json-schemas.ts).

| Call | System prompt | Output |
|---|---|---|
| Parse | `PARSE_SYSTEM` | `{ filters, rubric }` |
| Score | `SCORE_SYSTEM` | `{ scores: [{ profile_id, score, explanation, evidence }] }` |
| Refine | `REFINE_SYSTEM` | `{ filters, rubric, change_summary, changes }` |
| Repair | `REPAIR_SYSTEM` | Same schema as the failed call |

Pipeline: ask for structured JSON → Zod → if invalid, one repair with validator errors → transient errors retry. Structured-output hosts that reject `json_schema` fall back to `json_object`.

---

## Demo / Loom

Keep it under 15 minutes.

1. Start from the prefilled Bangalore RDS brief. Show thinking, then filters/rubric and five cards with quoted evidence.
2. Mark one “too junior” (or type it). Show the change summary and a new shortlist.
3. Optionally edit a chip and **Apply edits**.
4. Failure: set `OPENAI_API_KEY` to `invalid`, restart, **Retry**. The UI errors; it does not crash. Restore the key and retry.
5. Freeze. Walk the final filters, rubric, and ranked list.

Malformed-JSON recovery cannot be forced; the invalid-key path is the reliable on-camera failure. If a repair happens naturally, the green note is the recovery moment.

---

## Future scope

These are the next product slices *after* this loop is trusted. None of them belong in the time-boxed assignment.

| Theme | Enhancement | Why it waits |
|---|---|---|
| Scale | Real talent index (OpenSearch / warehouse) behind the same `ProfileRepository` | Filters stay code; only the repo changes. |
| Persistence | Saved searches, frozen shortlists, recruiter identity | Needs auth and a store. |
| Collaboration | Two recruiters on one search, comments on cards | Session model is single-actor. |
| Calibration | Learn from freezes: which filter changes stuck | Needs many sessions and analytics. |
| Coverage | Paginate beyond five during refine; score more than 16 in batches | Nice once the loop is trusted. |
| Streaming | Progress events (parse done / filter count / scoring) over SSE | Better wait UX without fake tokens. |
| Eval | Golden briefs + expected filter snapshots in CI | Prompt regressions. |
| Guardrails | Human-in-the-loop before freeze on regulated roles | Policy, not sourcing. |
| Outreach | Export freeze → sequence | A different product surface. |
| Observability | Prometheus / OTLP instead of `/api/metrics` | When there is more than one process. |
| Queue | Redis + workers for LLM | When one node’s semaphore is not enough. |

---

## Known limitations

- One Node process: memory sessions, in-process rate limits, and the circuit breaker do not share across replicas.
- `SCORE_CAP` can hide a strong candidate who failed the heuristic pre-rank when many people pass filters. Fine on 48 rows; revisit on a real index.
- Location and skill aliases are a hand list, not embeddings. That is a feature for explainability; it will miss odd spellings.
- Explanations are only as honest as the model. Zod cannot catch a fabricated employer name if it *looks* like a string. The prompt forbids invention; spot-check in review.
- `/api/metrics` and `/api/ready` leak operational shape (queue depth, circuit). Fine locally; gate them in production.
- CSP still allows `'unsafe-inline'` / `'unsafe-eval'` because Next.js needs them in this setup.

---

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Local desk |
| `npm run build` / `npm start` | Production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
