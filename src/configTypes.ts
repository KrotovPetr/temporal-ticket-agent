import { AutomationPolicy } from "./types.js";

export type AppConfig = {
  temporal: {
    address: string;
    namespace: string;
    taskQueue: string;
  };

  pollIntervalMs: number;

  llm: {
    provider: "mock" | "openai-compatible";
    baseUrl: string;
    apiKey?: string;
    model: string;
  };

  policy: AutomationPolicy;
};
