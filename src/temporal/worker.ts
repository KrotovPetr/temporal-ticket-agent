import { NativeConnection, Worker } from "@temporalio/worker";
import type { AppConfig } from "../configTypes.js";
import type { LlmClient } from "../llm/llmClient.js";
import type { TicketSourceAdapter } from "../types.js";
import { createActivities } from "./activities.js";

export async function runWorker(
  config: AppConfig,
  deps: {
    llmClient: LlmClient;
    ticketSource: TicketSourceAdapter;
  },
): Promise<void> {
  const connection = await NativeConnection.connect({
    address: config.temporal.address,
  });

  const worker = await Worker.create({
    connection,
    namespace: config.temporal.namespace,
    taskQueue: config.temporal.taskQueue,
    workflowsPath: new URL("./workflows.ts", import.meta.url).pathname,
    activities: createActivities({
      llmClient: deps.llmClient,
      ticketSource: deps.ticketSource,
      policy: config.policy,
    }),
  });

  console.log(
    `[worker] started. namespace=${config.temporal.namespace}, taskQueue=${config.temporal.taskQueue}`,
  );

  await worker.run();
}
