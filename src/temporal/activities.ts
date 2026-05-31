import type { LlmClient } from "../llm/llmClient.js";
import { applyPolicy } from "../policy.js";
import type {
  AddCommentInput,
  AddLabelsInput,
  AutomationPolicy,
  MarkProcessedInput,
  ProcessingStatus,
  Ticket,
  TicketAnalysis,
  TicketSourceAdapter,
} from "../types.js";

function labelsForStatus(status: ProcessingStatus): string[] {
  const statusLabelMap: Record<ProcessingStatus, string> = {
    llm_candidate: "ai:llm-candidate",
    human_required: "ai:human-required",
    rejected: "ai:rejected",
    failed: "ai:failed",
  };

  return ["ai:processed", statusLabelMap[status]];
}

function formatComment(input: MarkProcessedInput): string {
  const analysis = input.analysis;

  if (!analysis) {
    return [
      `AI triage result: ${input.status}`,
      input.reason ? `Reason: ${input.reason}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `AI triage result: ${input.status}`,
    ``,
    `Decision: ${analysis.decision}`,
    `Confidence: ${analysis.confidence}`,
    `Risk: ${analysis.risk}`,
    `Category: ${analysis.category}`,
    `Complexity: ${analysis.estimatedComplexity}`,
    `Reason: ${analysis.reason}`,
  ].join("\n");
}

export function createActivities(deps: {
  llmClient: LlmClient;
  ticketSource: TicketSourceAdapter;
  policy: AutomationPolicy;
}) {
  return {
    getTicketsListActivity: async (): Promise<Ticket[]> => {
      console.log("[activity] getTicketsListActivity");

      const tickets = await deps.ticketSource.getTicketsList();

      console.log(`[activity] fetched ${tickets.length} ticket(s)`);

      return tickets;
    },

    analyzeTicketActivity: async (ticket: Ticket): Promise<TicketAnalysis> => {
      console.log(`[activity] analyzeTicketActivity: ${ticket.id}`);

      const rawAnalysis = await deps.llmClient.analyzeTicket(ticket);
      const finalAnalysis = applyPolicy(ticket, rawAnalysis, deps.policy);

      console.log(
        `[activity] analysis result for ${ticket.id}: ${finalAnalysis.decision}`,
      );

      return finalAnalysis;
    },

    addLabelsActivity: async (input: AddLabelsInput): Promise<void> => {
      console.log(
        `[activity] addLabelsActivity: ${input.ticketId} -> ${input.labels.join(", ")}`,
      );

      await deps.ticketSource.addLabels(input);
    },

    addCommentActivity: async (input: AddCommentInput): Promise<void> => {
      console.log(`[activity] addCommentActivity: ${input.ticketId}`);

      await deps.ticketSource.addComment(input);
    },

    markProcessedActivity: async (input: MarkProcessedInput): Promise<void> => {
      console.log(
        `[activity] markProcessedActivity: ${input.ticketId} -> ${input.status}`,
      );

      await deps.ticketSource.markProcessed(input);
    },

    completeTicketProcessingActivity: async (
      input: MarkProcessedInput,
    ): Promise<void> => {
      console.log(
        `[activity] completeTicketProcessingActivity: ${input.ticketId} -> ${input.status}`,
      );

      const labels = labelsForStatus(input.status);
      const comment = formatComment(input);

      await deps.ticketSource.addLabels({
        ticketId: input.ticketId,
        labels,
      });

      await deps.ticketSource.addComment({
        ticketId: input.ticketId,
        comment,
      });

      await deps.ticketSource.markProcessed(input);
    },
  };
}

export type Activities = ReturnType<typeof createActivities>;
