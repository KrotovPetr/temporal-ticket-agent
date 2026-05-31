import { InMemoryTicketSource } from "./adapters/inMemoryTicketSource.js";
import { loadConfig } from "./config.js";
import type { LlmClient } from "./llm/llmClient.js";
import { MockLlmClient } from "./llm/mockLlmClient.js";
import { OpenAiCompatibleClient } from "./llm/openAiCompbitibleAgent.js";
import { runPoller } from "./poller.js";
import { runWorker } from "./temporal/worker.js";

function createLlmClient(config: ReturnType<typeof loadConfig>): LlmClient {
  if (config.llm.provider === "mock") {
    return new MockLlmClient();
  }

  return new OpenAiCompatibleClient({
    baseUrl: config.llm.baseUrl,
    apiKey: config.llm.apiKey,
    model: config.llm.model,
  });
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "all";
  const config = loadConfig();

  const ticketSource = new InMemoryTicketSource();
  const llmClient = createLlmClient(config);

  console.log(`[app] mode=${mode}`);
  console.log(`[app] llmProvider=${config.llm.provider}`);

  if (mode === "worker") {
    await runWorker(config, {
      llmClient,
      ticketSource,
    });
    return;
  }

  if (mode === "poller") {
    await runPoller(config, ticketSource);
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

    await runPoller(config, ticketSource);
    return;
  }

  throw new Error(`Unknown mode: ${mode}. Use worker, poller or all.`);
}

main().catch((error) => {
  console.error("[app] fatal error:", error);
  process.exit(1);
});
