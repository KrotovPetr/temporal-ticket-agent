import type {
  MarkProcessedInput,
  Ticket,
  TicketSourceAdapter,
} from "../types.js";

export class InMemoryTicketSource implements TicketSourceAdapter {
  private readonly tickets: Ticket[] = [
    {
      id: "DEMO-1",
      title: "Fix typo in README",
      description:
        "There is a small typo in the installation section of README. Please fix the spelling.",
      labels: ["demo", "docs"],
      url: "https://example.com/tickets/DEMO-1",
    },
    {
      id: "DEMO-2",
      title: "Change authentication flow",
      description:
        "We need to update auth and permission handling for enterprise users.",
      labels: ["demo", "security"],
      url: "https://example.com/tickets/DEMO-2",
    },
    {
      id: "DEMO-3",
      title: "Improve dashboard",
      description:
        "Make dashboard better and more useful for customers. Details TBD.",
      labels: ["demo", "feature"],
      url: "https://example.com/tickets/DEMO-3",
    },
    {
      id: "DEMO-4",
      title: "Add unit test for date formatter",
      description:
        "Add a simple unit test for date formatter edge case with empty input.",
      labels: ["demo", "test"],
      url: "https://example.com/tickets/DEMO-4",
    },
  ];

  private readonly processed = new Set<string>();

  async getTicketsList(): Promise<Ticket[]> {
    const pending = this.tickets.filter((ticket) => !this.processed.has(ticket.id));

    console.log(
      `[ticket-source] getTicketsList returned ${pending.length} pending ticket(s)`,
    );

    return pending;
  }

  async markProcessed(input: MarkProcessedInput): Promise<void> {
    this.processed.add(input.ticketId);

    console.log("[ticket-source] markProcessed:");
    console.log(JSON.stringify(input, null, 2));
  }

  async addComment(ticketId: string, comment: string): Promise<void> {
    console.log(`[ticket-source] addComment for ${ticketId}:`);
    console.log(comment);
  }
}
