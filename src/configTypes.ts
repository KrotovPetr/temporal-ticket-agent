import type { AutomationPolicy } from "./types.js";

export type TrackerProvider = "http" | "configurable-http";

export type LlmProvider = "mock" | "universal";

export type LlmApiStyle = "chat-completions" | "responses" | "responses-raw";

export type AppConfig = {
  temporal: {
    address: string;
    namespace: string;
    taskQueue: string;
  };

  pollIntervalMs: number;

  tracker: {
    provider: TrackerProvider;
    baseUrl: string;
    apiKey?: string;
    configPath?: string;
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
