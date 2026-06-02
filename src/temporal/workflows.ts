import {
  ChildWorkflowCancellationType,
  ParentClosePolicy,
  executeChild,
  proxyActivities,
  workflowInfo,
} from "@temporalio/workflow";
import type { Activities } from "./activities.js";
import type {
  AnalysisDecision,
  ChildTicketWorkflowResult,
  MarkProcessedInput,
  PollTrackerWorkflowResult,
  ProcessingStatus,
  Ticket,
} from "../types.js";

const activities = proxyActivities<Activities>({
  startToCloseTimeout: "1 minute",
  retry: {
    maximumAttempts: 3,
  },
});

function statusFromDecision(decision: AnalysisDecision): ProcessingStatus {
  if (decision === "llm") return "llm_candidate";
  if (decision === "reject") return "rejected";
  if (decision === "needs_context") return "needs_context";
  return "human_required";
}

function childWorkflowIdForTicket(ticket: Ticket): string {
  return `ticket-analysis-${ticket.id}`;
}

export async function ticketAnalysisWorkflow(
  ticket: Ticket,
): Promise<ChildTicketWorkflowResult> {
  try {
    const analysis = await activities.analyzeTicketActivity(ticket);
    const status = statusFromDecision(analysis.decision);

    const markInput: MarkProcessedInput = {
      ticketId: ticket.id,
      status,
      analysis,
    };

    await activities.completeTicketProcessingActivity(markInput);

    return {
      ticketId: ticket.id,
      status,
    };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : `Unknown workflow error: ${String(error)}`;

    const markInput: MarkProcessedInput = {
      ticketId: ticket.id,
      status: "failed",
      reason,
    };

    await activities.completeTicketProcessingActivity(markInput);

    return {
      ticketId: ticket.id,
      status: "failed",
    };
  }
}

export async function pollTrackerWorkflow(): Promise<PollTrackerWorkflowResult> {
  const info = workflowInfo();
  const pollId = info.workflowId;

  const tickets = await activities.getTicketsListActivity();

  const childResults = await Promise.all(
    tickets.map((ticket) =>
      executeChild(ticketAnalysisWorkflow, {
        workflowId: childWorkflowIdForTicket(ticket),
        args: [ticket],
        parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
        cancellationType:
          ChildWorkflowCancellationType.WAIT_CANCELLATION_COMPLETED,
      }),
    ),
  );

  return {
    pollId,
    totalTickets: tickets.length,
    results: childResults,
  };
}
