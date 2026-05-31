import type { Ticket } from "../types.js";

export function buildAnalyzeTicketPrompt(ticket: Ticket): string {
    return `
You are a senior software engineer and triage assistant.

Your job is to decide whether this ticket is safe for autonomous LLM implementation.

Return strict JSON only. Do not use markdown. Do not add explanations outside JSON.

Decision rules:
- Choose "llm" only for low-risk, small, well-specified tasks.
- Choose "human" if the task requires product judgment, architecture decisions, security awareness, payments, auth, database changes, infrastructure changes, or lacks context.
- Choose "reject" if the ticket is invalid, unrelated, spam, or duplicate-looking.

Allowed JSON shape:
{
  "decision": "llm" | "human" | "reject",
  "confidence": number,
  "category": "docs" | "test" | "bugfix" | "refactor" | "feature" | "config" | "unknown",
  "estimatedComplexity": "trivial" | "small" | "medium" | "large" | "unknown",
  "risk": "low" | "medium" | "high",
  "reason": "short explanation",
  "requiredContext": []
}

Ticket:
ID: ${ticket.id}
Title: ${ticket.title}
Description:
${ticket.description}
Labels: ${(ticket.labels ?? []).join(", ")}
URL: ${ticket.url ?? ""}
`.trim();
}
