import "dotenv/config";
import type {
  AppConfig,
  LlmApiStyle,
  LlmProvider,
  TrackerProvider,
} from "./configTypes.js";
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

function parseJsonObjectEnv(
  name: string,
  fallback: string,
): Record<string, string> {
  const raw = getEnv(name, fallback);

  try {
    const parsed = JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("value is not an object");
    }

    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== "string") {
        throw new Error(`value of "${key}" must be a string`);
      }

      result[key] = value;
    }

    return result;
  } catch (error) {
    throw new Error(
      `Invalid ${name}. Expected JSON object with string values. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function parseTrackerProvider(value: string): TrackerProvider {
  if (value === "http" || value === "configurable-http") {
    return value;
  }

  throw new Error(`Invalid TRACKER_PROVIDER: ${value}`);
}

function parseLlmProvider(value: string): LlmProvider {
  if (value === "mock" || value === "universal") {
    return value;
  }

  throw new Error(`Invalid LLM_PROVIDER: ${value}`);
}

function parseLlmApiStyle(value: string): LlmApiStyle {
  if (
    value === "chat-completions" ||
    value === "responses" ||
    value === "responses-raw"
  ) {
    return value;
  }

  throw new Error(`Invalid LLM_API_STYLE: ${value}`);
}

export function loadConfig(): AppConfig {
  return {
    temporal: {
      address: getEnv("TEMPORAL_ADDRESS", "localhost:7233"),
      namespace: getEnv("TEMPORAL_NAMESPACE", "default"),
      taskQueue: getEnv("TEMPORAL_TASK_QUEUE", "ticket-autopilot"),
    },

    pollIntervalMs: Number(getEnv("POLL_INTERVAL_MS", "10000")),

    tracker: {
      provider: parseTrackerProvider(getEnv("TRACKER_PROVIDER", "http")),
      baseUrl: getEnv("TRACKER_BASE_URL", "http://localhost:4000"),
      apiKey: process.env.TRACKER_API_KEY || undefined,
      configPath: process.env.TRACKER_CONFIG_PATH || undefined,
    },

    llm: {
      provider: parseLlmProvider(getEnv("LLM_PROVIDER", "mock")),
      apiStyle: parseLlmApiStyle(getEnv("LLM_API_STYLE", "chat-completions")),
      baseUrl: getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
      apiKey: process.env.LLM_API_KEY || undefined,
      model: process.env.LLM_MODEL || undefined,
      promptId: process.env.LLM_PROMPT_ID || undefined,
      headers: parseJsonObjectEnv("LLM_HEADERS_JSON", "{}"),
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

    demoTracker: {
      port: Number(getEnv("DEMO_TRACKER_PORT", "4000")),
    },
  };
}
