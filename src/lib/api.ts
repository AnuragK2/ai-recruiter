import type { ApiErrorBody, Filters, PublicSession, Rubric, Vote } from "./types";

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  status: number;

  constructor(status: number, body: ApiErrorBody["error"]) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.retryable = body.retryable;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": crypto.randomUUID(),
      ...(init?.headers ?? {}),
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload as ApiErrorBody | null)?.error;
    throw new ApiError(response.status, {
      code: error?.code || "internal",
      message: error?.message || "Request failed.",
      retryable: error?.retryable ?? response.status >= 500,
    });
  }

  return payload as T;
}

type SessionResponse = { session: PublicSession };

export function createSession(query: string) {
  return request<SessionResponse>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export function patchSession(id: string, filters: Filters, rubric: Rubric) {
  return request<SessionResponse>(`/api/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ filters, rubric }),
  });
}

export function refineSession(id: string, input: { message: string; votes: Vote[] }) {
  return request<SessionResponse>(`/api/sessions/${id}/refine`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function freezeSession(id: string) {
  return request<SessionResponse>(`/api/sessions/${id}/freeze`, {
    method: "POST",
  });
}
