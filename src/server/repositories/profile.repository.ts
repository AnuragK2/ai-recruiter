import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { COMPANY_TYPES, type Profile } from "@/lib/types";
import { AppError } from "../errors";
import { logger } from "../logger";

const pastCompanySchema = z.object({
  company: z.string().min(1),
  company_type: z.enum(COMPANY_TYPES),
  title: z.string().min(1),
  years: z.number().nonnegative(),
});

const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  current_title: z.string().min(1),
  years_experience: z.number().nonnegative(),
  location: z.string().min(1),
  current_company: z.string().min(1),
  current_company_type: z.enum(COMPANY_TYPES),
  skills: z.array(z.string()),
  past_companies: z.array(pastCompanySchema),
  education: z.string(),
  summary: z.string(),
});

export class ProfileRepository {
  private profiles: readonly Profile[] | null = null;

  load(): readonly Profile[] {
    if (this.profiles) return this.profiles;
    try {
      const raw = readFileSync(join(process.cwd(), "data/profiles.json"), "utf8");
      const parsed = z.array(profileSchema).min(1).parse(JSON.parse(raw));
      this.profiles = Object.freeze(parsed);
      logger.info({ msg: "profiles.loaded", count: parsed.length });
      return this.profiles;
    } catch (error) {
      throw new AppError("internal", "Talent map could not be loaded.", {
        cause: error,
        expose: false,
      });
    }
  }

  findAll(): readonly Profile[] {
    return this.load();
  }

  findById(id: string): Profile | null {
    return this.load().find((profile) => profile.id === id) ?? null;
  }

  get size(): number {
    return this.load().length;
  }
}
