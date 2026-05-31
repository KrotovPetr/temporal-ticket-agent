import type { LlmClient } from "../llm/llmClient.js";
import { applyPolicy } from "../policy.js";
import type {
  AutomationPolicy,
  MarkProcessedInput,
  Ticket,
  TicketAnalysis,
  TicketSourceAdapter,
} from "../types.js";

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
    analyzeTicketActivity: async (ticket: Ticket): Promise<TicketAnalysis> => {
      console.log(`[activity] analyzeTicketActivity: ${ticket.id}`);

      const rawAnalysis = await deps.llmClient.analyzeTicket(ticket);
      const finalAnalysis = applyPolicy(ticket, rawAnalysis, deps.policy);

      console.log(
        `[activity] analysis result for ${ticket.id}: ${finalAnalysis.decision}`,
      );

      return finalAnalysis;
    },

    markProcessedActivity: async (input: MarkProcessedInput): Promise<void> => {
      console.log(
        `[activity] markProcessedActivity: ${input.ticketId} -> ${input.status}`,
      );

      await deps.ticketSource.markProcessed(input);

      if (deps.ticketSource.addComment) {
        await deps.ticketSource.addComment(input.ticketId, formatComment(input));
      }
    },
  };
}

export type Activities = ReturnType<typeof createActivities>;
