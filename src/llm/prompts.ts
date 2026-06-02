import type { Ticket } from "../types.js";

export function buildAnalyzeTicketPrompt(ticket: Ticket): string {
  return `
You are a senior software engineer and triage assistant.

Your job is to decide whether this ticket is safe for autonomous LLM implementation.

Return strict JSON only. Do not use markdown. Do not add explanations outside JSON.

Decision rules:
- Choose "llm" only for low-risk, small, well-specified tasks with clear acceptance criteria.
- Choose "human" if the task requires product judgment, architecture decisions, security awareness, payments, auth, database changes, infrastructure changes, or has a large blast radius.
- Choose "needs_context" if the ticket lacks enough information to make a safe decision: description is vague, acceptance criteria are missing, scope is unclear, or reproduction steps are absent for a bug. When choosing "needs_context", list in "requiredContext" the specific pieces of information that would make triage possible.
- Choose "reject" if the ticket is invalid, unrelated to software development, spam, or a clear duplicate.

Allowed JSON shape:
{
  "decision": "llm" | "human" | "needs_context" | "reject",
  "confidence": number,
  "category": "docs" | "test" | "bugfix" | "refactor" | "feature" | "config" | "unknown",
  "estimatedComplexity": "trivial" | "small" | "medium" | "large" | "unknown",
  "risk": "low" | "medium" | "high",
  "reason": "short explanation",
  "requiredContext": ["list of missing information items, empty if not needs_context"]
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
