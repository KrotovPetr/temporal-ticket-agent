import { proxyActivities } from "@temporalio/workflow";
import type { Activities } from "./activities.js";
import type {
  MarkProcessedInput,
  ProcessingStatus,
  Ticket,
  WorkflowResult,
} from "../types.js";

const activities = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    maximumAttempts: 3,
  },
});

export async function ticketProcessingWorkflow(
  ticket: Ticket,
): Promise<WorkflowResult> {
  const analysis = await activities.analyzeTicketActivity(ticket);

  let status: ProcessingStatus;

  if (analysis.decision === "llm") {
    status = "llm_candidate";
  } else if (analysis.decision === "reject") {
    status = "rejected";
  } else {
    status = "human_required";
  }

  const markInput: MarkProcessedInput = {
    ticketId: ticket.id,
    status,
    analysis,
  };

  await activities.markProcessedActivity(markInput);

  return {
    ticketId: ticket.id,
    status,
  };
}
