import type { Ticket, TicketAnalysis } from "../types.js";

export interface LlmClient {
  analyzeTicket(ticket: Ticket): Promise<TicketAnalysis>;
}
