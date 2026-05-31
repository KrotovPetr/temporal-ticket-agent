export type Ticket = {
  id: string;
  title: string;
  description: string;
  url?: string;
  labels?: string[];
  metadata?: Record<string, unknown>;
};

export type AnalysisDecision = "llm" | "human" | "reject";

export type TicketCategory =
  | "docs"
  | "test"
  | "bugfix"
  | "refactor"
  | "feature"
  | "config"
  | "unknown";

export type TicketComplexity =
  | "trivial"
  | "small"
  | "medium"
  | "large"
  | "unknown";

export type TicketRisk = "low" | "medium" | "high";

export type TicketAnalysis = {
  decision: AnalysisDecision;
  confidence: number;
  category: TicketCategory;
  estimatedComplexity: TicketComplexity;
  risk: TicketRisk;
  reason: string;
  requiredContext?: string[];
};

export type ProcessingStatus =
  | "llm_candidate"
  | "human_required"
  | "rejected"
  | "failed";

export type MarkProcessedInput = {
  ticketId: string;
  status: ProcessingStatus;
  analysis?: TicketAnalysis;
  reason?: string;
};

export interface TicketSourceAdapter {
  getTicketsList(): Promise<Ticket[]>;
  markProcessed(input: MarkProcessedInput): Promise<void>;
  addComment?(ticketId: string, comment: string): Promise<void>;
}

export type AutomationPolicy = {
  minConfidence: number;
  allowedCategories: TicketCategory[];
  allowedLabels?: string[];
  blockedLabels?: string[];
  forbiddenKeywords: string[];
};

export type WorkflowResult = {
  ticketId: string;
  status: ProcessingStatus;
};
