import type { AutomationPolicy } from "./types.js";

export type LlmProvider = "mock" | "universal";

export type LlmApiStyle = "chat-completions" | "responses";

export type AppConfig = {
  temporal: {
    address: string;
    namespace: string;
    taskQueue: string;
  };

  pollIntervalMs: number;

  tracker: {
    baseUrl: string;
    apiKey?: string;
  };

  llm: {
    provider: LlmProvider;
    apiStyle: LlmApiStyle;
    baseUrl: string;
    apiKey?: string;
    model?: string;
    promptId?: string;
    headers: Record<string, string>;
  };

  policy: AutomationPolicy;

  demoTracker: {
    port: number;
  };
};
