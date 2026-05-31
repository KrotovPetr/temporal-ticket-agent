import { HttpTrackerAdapter } from "./adapters/httpTrackerAdapter.js";
import { loadConfig } from "./config.js";
import { startDemoTrackerServer } from "./demo-tracker/server.js";
import type { LlmClient } from "./llm/llmClient.js";
import { MockLlmClient } from "./llm/mockLlmClient.js";
import { UniversalLlmClient } from "./llm/universalLlmClient.js";
import { runPoller } from "./poller.js";
import { runWorker } from "./temporal/worker.js";

function createLlmClient(config: ReturnType<typeof loadConfig>): LlmClient {
  if (config.llm.provider === "mock") {
    return new MockLlmClient();
  }

  return new UniversalLlmClient({
    apiStyle: config.llm.apiStyle,
    baseUrl: config.llm.baseUrl,
    apiKey: config.llm.apiKey,
    model: config.llm.model,
    promptId: config.llm.promptId,
    headers: config.llm.headers,
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "demo-all";
  const config = loadConfig();

  const ticketSource = new HttpTrackerAdapter({
    baseUrl: config.tracker.baseUrl,
    apiKey: config.tracker.apiKey,
  });

  const llmClient = createLlmClient(config);

  console.log(`[app] mode=${mode}`);
  console.log(`[app] tracker=${config.tracker.baseUrl}`);
  console.log(`[app] llmProvider=${config.llm.provider}`);
  console.log(`[app] llmApiStyle=${config.llm.apiStyle}`);

  if (mode === "demo-tracker") {
    await startDemoTrackerServer({
      port: config.demoTracker.port,
    });

    await new Promise(() => {
      // keep process alive
    });
    return;
  }

  if (mode === "worker") {
    await runWorker(config, {
      llmClient,
      ticketSource,
    });
    return;
  }

  if (mode === "poller") {
    await runPoller(config);
    return;
  }

  if (mode === "all") {
    void runWorker(config, {
      llmClient,
      ticketSource,
    }).catch((error) => {
      console.error("[worker] failed:", error);
      process.exitCode = 1;
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await runPoller(config);
    return;
  }

  if (mode === "demo-all") {
    await startDemoTrackerServer({
      port: config.demoTracker.port,
    });

    void runWorker(config, {
      llmClient,
      ticketSource,
    }).catch((error) => {
      console.error("[worker] failed:", error);
      process.exitCode = 1;
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await runPoller(config);
    return;
  }

  throw new Error(
    `Unknown mode: ${mode}. Use demo-tracker, worker, poller, all or demo-all.`,
  );
}

main().catch((error) => {
  console.error("[app] fatal error:", error);
  process.exit(1);
});
