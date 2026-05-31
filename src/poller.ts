import { WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import type { AppConfig } from "./configTypes.js";
import { createTemporalClient } from "./temporal/client.js";
import { ticketProcessingWorkflow } from "./temporal/workflows.js";
import type { Ticket, TicketSourceAdapter } from "./types.js";

function workflowIdForTicket(ticket: Ticket): string {
  return `ticket-${ticket.id}`;
}

export async function runPoller(
  config: AppConfig,
  ticketSource: TicketSourceAdapter,
): Promise<void> {
  const client = await createTemporalClient(config);
  let isPolling = false;

  async function pollOnce(): Promise<void> {
    if (isPolling) {
      console.log("[poller] previous poll is still running, skipping");
      return;
    }

    isPolling = true;

    try {
      console.log("[poller] polling tickets...");

      const tickets = await ticketSource.getTicketsList();

      for (const ticket of tickets) {
        const workflowId = workflowIdForTicket(ticket);

        try {
          await client.workflow.start(ticketProcessingWorkflow, {
            taskQueue: config.temporal.taskQueue,
            workflowId,
            args: [ticket],
          });

          console.log(
            `[poller] started workflow ${workflowId} for ticket ${ticket.id}`,
          );
        } catch (error) {
          if (error instanceof WorkflowExecutionAlreadyStartedError) {
            console.log(
              `[poller] workflow already started for ticket ${ticket.id}, ignoring`,
            );
            continue;
          }

          throw error;
        }
      }
    } catch (error) {
      console.error("[poller] poll failed:", error);
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
