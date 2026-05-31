import { z } from "zod";
import type {
  AddCommentInput,
  AddLabelsInput,
  MarkProcessedInput,
  Ticket,
  TicketSourceAdapter,
} from "../types.js";

const TicketSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  url: z.string().optional(),
  labels: z.array(z.string()).optional(),
  attributes: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const TicketsResponseSchema = z.object({
  tickets: z.array(TicketSchema),
});

type HttpTrackerAdapterOptions = {
  baseUrl: string;
  apiKey?: string;
};

export class HttpTrackerAdapter implements TicketSourceAdapter {
  private readonly baseUrl: string;

  constructor(private readonly options: HttpTrackerAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  async getTicketsList(): Promise<Ticket[]> {
    const response = await fetch(`${this.baseUrl}/tickets`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to fetch tickets: ${response.status} ${response.statusText}: ${body}`,
      );
    }

    const data = await response.json();
    const parsed = TicketsResponseSchema.safeParse(data);

    if (!parsed.success) {
      throw new Error(`Invalid tickets response: ${parsed.error.message}`);
    }

    return parsed.data.tickets;
  }

  async markProcessed(input: MarkProcessedInput): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/tickets/${encodeURIComponent(input.ticketId)}/processed`,
      {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to mark ticket as processed: ${response.status} ${response.statusText}: ${body}`,
      );
    }
  }

  async addLabels(input: AddLabelsInput): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/tickets/${encodeURIComponent(input.ticketId)}/labels`,
      {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          labels: input.labels,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to add labels: ${response.status} ${response.statusText}: ${body}`,
      );
    }
  }

  async addComment(input: AddCommentInput): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/tickets/${encodeURIComponent(input.ticketId)}/comments`,
      {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: input.comment,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to add ticket comment: ${response.status} ${response.statusText}: ${body}`,
      );
    }
  }

  private headers(): Record<string, string> {
    return {
      Accept: "application/json",
      ...(this.options.apiKey
        ? { Authorization: `Bearer ${this.options.apiKey}` }
        : {}),
    };
  }
}
