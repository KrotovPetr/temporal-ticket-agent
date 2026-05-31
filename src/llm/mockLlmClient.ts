import type { LlmClient } from "./llmClient.js";
import type { Ticket, TicketAnalysis } from "../types.js";

function containsAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

export class MockLlmClient implements LlmClient {
  async analyzeTicket(ticket: Ticket): Promise<TicketAnalysis> {
    const text = `${ticket.title}\n${ticket.description}`;

    if (
      containsAny(text, [
        "auth",
        "authentication",
        "authorization",
        "payment",
        "billing",
        "security",
        "migration",
        "database",
        "secret",
        "permission",
      ])
    ) {
      return {
        decision: "human",
        confidence: 0.95,
        category: "unknown",
        estimatedComplexity: "medium",
        risk: "high",
        reason:
          "Ticket touches sensitive or high-risk area and should be reviewed by a human.",
        requiredContext: [],
      };
    }

    if (
      containsAny(text, [
        "typo",
        "readme",
        "docs",
        "documentation",
        "copy",
        "text",
        "spelling",
      ])
    ) {
      return {
        decision: "llm",
        confidence: 0.92,
        category: "docs",
        estimatedComplexity: "trivial",
        risk: "low",
        reason:
          "Documentation or copy-only change looks small and safe for autonomous handling.",
        requiredContext: [],
      };
    }

    if (containsAny(text, ["test", "spec", "unit test", "coverage"])) {
      return {
        decision: "llm",
        confidence: 0.84,
        category: "test",
        estimatedComplexity: "small",
        risk: "low",
        reason: "Small test-related task appears well-scoped.",
        requiredContext: [],
      };
    }

    if (containsAny(text, ["duplicate", "spam", "invalid"])) {
      return {
        decision: "reject",
        confidence: 0.8,
        category: "unknown",
        estimatedComplexity: "unknown",
        risk: "medium",
        reason: "Ticket appears invalid or duplicate.",
        requiredContext: [],
      };
    }

    return {
      decision: "human",
      confidence: 0.6,
      category: "unknown",
      estimatedComplexity: "unknown",
      risk: "medium",
      reason:
        "Ticket does not have enough clear context to safely automate in this prototype.",
      requiredContext: ["More precise acceptance criteria"],
    };
  }
}
