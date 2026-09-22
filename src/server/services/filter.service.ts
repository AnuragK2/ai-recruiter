import { applyFilters, emptyHints, heuristicRank } from "@/lib/filter";
import type { EmptyHint, Filters, Profile } from "@/lib/types";
import { stableHash, TtlCache } from "../cache";
import { getConfig } from "../config";
import { metrics } from "../metrics";
import type { ProfileRepository } from "../repositories/profile.repository";

export class FilterService {
  private readonly cache: TtlCache<string[]>;

  constructor(private readonly profiles: ProfileRepository) {
    this.cache = new TtlCache<string[]>(getConfig().FILTER_CACHE_TTL_MS);
  }

  apply(filters: Filters): Profile[] {
    const key = stableHash(filters);
    const cached = this.cache.get(key);
    const pool = this.profiles.findAll();
    if (cached) {
      metrics.inc("cacheHits");
      const byId = new Map(pool.map((profile) => [profile.id, profile]));
      return cached
        .map((id) => byId.get(id))
        .filter((profile): profile is Profile => profile != null);
    }
    metrics.inc("cacheMisses");
    const matched = applyFilters([...pool], filters);
    this.cache.set(
      key,
      matched.map((profile) => profile.id),
    );
    return matched;
  }

  preRank(profiles: Profile[], filters: Filters): Profile[] {
    return heuristicRank(profiles, filters);
  }

  hints(filters: Filters): EmptyHint[] {
    return emptyHints(filters, [...this.profiles.findAll()]);
  }
}
