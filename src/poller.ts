import { WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import type { AppConfig } from "./configTypes.js";
import { createTemporalClient } from "./temporal/client.js";
import { pollTrackerWorkflow } from "./temporal/workflows.js";

function createPollWorkflowId(): string {
  return `poll-tracker-${Date.now()}`;
}

export async function runPoller(config: AppConfig): Promise<void> {
  const client = await createTemporalClient(config);
  let isPolling = false;

  async function pollOnce(): Promise<void> {
    if (isPolling) {
      console.log("[poller] previous poll is still running, skipping");
      return;
    }

    isPolling = true;

    try {
      const workflowId = createPollWorkflowId();

      console.log(`[poller] starting poll workflow: ${workflowId}`);

      await client.workflow.start(pollTrackerWorkflow, {
        taskQueue: config.temporal.taskQueue,
        workflowId,
        args: [],
      });

      console.log(`[poller] started poll workflow: ${workflowId}`);
    } catch (error) {
      if (error instanceof WorkflowExecutionAlreadyStartedError) {
        console.log("[poller] poll workflow already started, ignoring");
        return;
      }

      console.error("[poller] failed to start poll workflow:", error);
    } finally {
      isPolling = false;
    }
  }

  await pollOnce();

  setInterval(() => {
    void pollOnce();
  }, config.pollIntervalMs);

  console.log(`[poller] started. interval=${config.pollIntervalMs}ms`);

  await new Promise(() => {
    // keep process alive
  });
}
