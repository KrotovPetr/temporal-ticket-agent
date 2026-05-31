import "dotenv/config";
import type { AppConfig } from "./configTypes.js";
import type { TicketCategory } from "./types.js";

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name];

  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAllowedCategories(value: string): TicketCategory[] {
  const allowed = new Set<TicketCategory>([
    "docs",
    "test",
    "bugfix",
    "refactor",
    "feature",
    "config",
    "unknown",
  ]);

  return parseCsv(value).filter((item): item is TicketCategory =>
    allowed.has(item as TicketCategory),
  );
}

export function loadConfig(): AppConfig {
  return {
    temporal: {
      address: getEnv("TEMPORAL_ADDRESS", "localhost:7233"),
      namespace: getEnv("TEMPORAL_NAMESPACE", "default"),
      taskQueue: getEnv("TEMPORAL_TASK_QUEUE", "ticket-autopilot"),
    },

    pollIntervalMs: Number(getEnv("POLL_INTERVAL_MS", "10000")),

    llm: {
      provider: getEnv("LLM_PROVIDER", "mock") as
        | "mock"
        | "openai-compatible",
      baseUrl: getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
      apiKey: process.env.LLM_API_KEY || undefined,
      model: getEnv("LLM_MODEL", "gpt-4o-mini"),
    },

    policy: {
      minConfidence: Number(getEnv("MIN_CONFIDENCE", "0.75")),
      allowedCategories: parseAllowedCategories(
        getEnv("ALLOWED_CATEGORIES", "docs,test,bugfix,config"),
      ),
      forbiddenKeywords: parseCsv(
        getEnv(
          "FORBIDDEN_KEYWORDS",
          "auth,security,payment,billing,permission,database migration,infrastructure,secrets,encryption,compliance",
        ),
      ),
    },
  };
}
