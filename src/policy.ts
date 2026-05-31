import type { AutomationPolicy, Ticket, TicketAnalysis } from "./types.js";

function includesIgnoreCase(text: string, needle: string): boolean {
  return text.toLowerCase().includes(needle.toLowerCase());
}

function hasAnyLabel(ticketLabels: string[] | undefined, labels: string[]): boolean {
  const normalizedTicketLabels = new Set(
    (ticketLabels ?? []).map((label) => label.toLowerCase()),
  );

  return labels.some((label) => normalizedTicketLabels.has(label.toLowerCase()));
}

function forceHuman(
  analysis: TicketAnalysis,
  reason: string,
  risk: "medium" | "high" = "high",
): TicketAnalysis {
  return {
    ...analysis,
    decision: "human",
    risk,
    reason,
  };
}

export function applyPolicy(
  ticket: Ticket,
  analysis: TicketAnalysis,
  policy: AutomationPolicy,
): TicketAnalysis {
  const labels = ticket.labels ?? [];

  if (policy.blockedLabels && hasAnyLabel(labels, policy.blockedLabels)) {
    return forceHuman(
      analysis,
      `Forced human review: ticket contains blocked label. Original reason: ${analysis.reason}`,
      "high",
    );
  }

  if (policy.allowedLabels && policy.allowedLabels.length > 0) {
    const hasAllowedLabel = hasAnyLabel(labels, policy.allowedLabels);

    if (!hasAllowedLabel) {
      return forceHuman(
        analysis,
        `Forced human review: ticket does not contain any allowed automation label. Original reason: ${analysis.reason}`,
        "medium",
      );
    }
  }

  const searchableText = `${ticket.title}\n${ticket.description}`;

  const forbiddenKeyword = policy.forbiddenKeywords.find((keyword) =>
    includesIgnoreCase(searchableText, keyword),
  );

  if (forbiddenKeyword) {
    return forceHuman(
      analysis,
      `Forced human review: ticket contains forbidden keyword "${forbiddenKeyword}". Original reason: ${analysis.reason}`,
      "high",
    );
  }

  if (analysis.decision !== "llm") {
    return analysis;
  }

  const allowedByConfidence = analysis.confidence >= policy.minConfidence;
  const allowedByRisk = analysis.risk === "low";
  const allowedByComplexity =
    analysis.estimatedComplexity === "trivial" ||
    analysis.estimatedComplexity === "small";
  const allowedByCategory = policy.allowedCategories.includes(analysis.category);

  if (
    allowedByConfidence &&
    allowedByRisk &&
    allowedByComplexity &&
    allowedByCategory
  ) {
    return analysis;
  }

  const reasons: string[] = [];

  if (!allowedByConfidence) {
    reasons.push(
      `confidence ${analysis.confidence} is below ${policy.minConfidence}`,
    );
  }

  if (!allowedByRisk) {
    reasons.push(`risk is ${analysis.risk}, expected low`);
  }

  if (!allowedByComplexity) {
    reasons.push(
      `complexity is ${analysis.estimatedComplexity}, expected trivial or small`,
    );
  }

  if (!allowedByCategory) {
    reasons.push(
      `category ${analysis.category} is not allowed. Allowed: ${policy.allowedCategories.join(", ")}`,
    );
  }

  return forceHuman(
    analysis,
    `Forced human review by policy: ${reasons.join("; ")}. Original reason: ${analysis.reason}`,
    analysis.risk === "high" ? "high" : "medium",
  );
}
