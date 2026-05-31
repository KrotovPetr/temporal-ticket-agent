import type {
  AddCommentInput,
  AddLabelsInput,
  MarkProcessedInput,
  Ticket,
} from "../types.js";

export type DemoTicket = Ticket & {
  attributes: {
    processed?: boolean;
    processingStatus?: string;
    analysisDecision?: string;
    analysisConfidence?: number;
    analysisRisk?: string;
    analysisReason?: string;
  };
  comments: string[];
};

export class DemoTrackerStore {
  private readonly tickets = new Map<string, DemoTicket>();

  constructor() {
    const initialTickets: DemoTicket[] = [
      {
        id: "DEMO-1",
        title: "Fix typo in README",
        description:
          "There is a small typo in the installation section of README. Please fix the spelling.",
        labels: ["demo", "docs"],
        url: "http://localhost:4000/tickets/DEMO-1",
        attributes: {},
        comments: [],
      },
      {
        id: "DEMO-2",
        title: "Change authentication flow",
        description:
          "We need to update auth and permission handling for enterprise users.",
        labels: ["demo", "security"],
        url: "http://localhost:4000/tickets/DEMO-2",
        attributes: {},
        comments: [],
      },
      {
        id: "DEMO-3",
        title: "Improve dashboard",
        description:
          "Make dashboard better and more useful for customers. Details TBD.",
        labels: ["demo", "feature"],
        url: "http://localhost:4000/tickets/DEMO-3",
        attributes: {},
        comments: [],
      },
      {
        id: "DEMO-4",
        title: "Add unit test for date formatter",
        description:
          "Add a simple unit test for date formatter edge case with empty input.",
        labels: ["demo", "test"],
        url: "http://localhost:4000/tickets/DEMO-4",
        attributes: {},
        comments: [],
      },
    ];

    for (const ticket of initialTickets) {
      this.tickets.set(ticket.id, ticket);
    }
  }

  listPendingTickets(): Ticket[] {
    return Array.from(this.tickets.values())
      .filter((ticket) => !ticket.attributes.processed)
      .map(this.toPublicTicket);
  }

  listAllTickets(): DemoTicket[] {
    return Array.from(this.tickets.values());
  }

  getTicket(ticketId: string): DemoTicket | undefined {
    return this.tickets.get(ticketId);
  }

  markProcessed(input: MarkProcessedInput): DemoTicket {
    const ticket = this.tickets.get(input.ticketId);

    if (!ticket) {
      throw new Error(`Ticket not found: ${input.ticketId}`);
    }

    ticket.attributes.processed = true;
    ticket.attributes.processingStatus = input.status;

    if (input.analysis) {
      ticket.attributes.analysisDecision = input.analysis.decision;
      ticket.attributes.analysisConfidence = input.analysis.confidence;
      ticket.attributes.analysisRisk = input.analysis.risk;
      ticket.attributes.analysisReason = input.analysis.reason;
    }

    return ticket;
  }

  addLabels(input: AddLabelsInput): DemoTicket {
    const ticket = this.tickets.get(input.ticketId);

    if (!ticket) {
      throw new Error(`Ticket not found: ${input.ticketId}`);
    }

    const currentLabels = ticket.labels ?? [];
    const nextLabels = new Set(currentLabels);

    for (const label of input.labels) {
      nextLabels.add(label);
    }

    ticket.labels = Array.from(nextLabels);

    return ticket;
  }

  addComment(input: AddCommentInput): DemoTicket {
    const ticket = this.tickets.get(input.ticketId);

    if (!ticket) {
      throw new Error(`Ticket not found: ${input.ticketId}`);
    }

    ticket.comments.push(input.comment);

    return ticket;
  }

  private toPublicTicket(ticket: DemoTicket): Ticket {
    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      url: ticket.url,
      labels: ticket.labels,
      attributes: ticket.attributes,
      metadata: ticket.metadata,
    };
  }
}
