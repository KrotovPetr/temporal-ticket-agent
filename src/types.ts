export type Ticket = {
  id: string;
  title: string;
  description: string;
  url?: string;
  labels?: string[];
  attributes?: Record<string, unknown>;
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

export type AddLabelsInput = {
  ticketId: string;
  labels: string[];
};

export type AddCommentInput = {
  ticketId: string;
  comment: string;
};

export interface TicketSourceAdapter {
  getTicketsList(): Promise<Ticket[]>;
  markProcessed(input: MarkProcessedInput): Promise<void>;
  addLabels(input: AddLabelsInput): Promise<void>;
  addComment(input: AddCommentInput): Promise<void>;
}

export type AutomationPolicy = {
  minConfidence: number;
  allowedCategories: TicketCategory[];
  allowedLabels?: string[];
  blockedLabels?: string[];
  forbiddenKeywords: string[];
};

export type ChildTicketWorkflowResult = {
  ticketId: string;
  status: ProcessingStatus;
};

export type PollTrackerWorkflowResult = {
  pollId: string;
  totalTickets: number;
  results: ChildTicketWorkflowResult[];
};
