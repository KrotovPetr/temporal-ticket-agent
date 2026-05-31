import fs from "node:fs";
import path from "node:path";
import type {
  AddCommentInput,
  AddLabelsInput,
  MarkProcessedInput,
  Ticket,
  TicketSourceAdapter,
} from "../types.js";
import {
  ConfigurableTrackerConfigSchema,
  type ConfigurableTrackerConfig,
  type HttpRequestConfig,
} from "./configurable/configSchema.js";
import {
  getByPath,
  getStringArrayByPath,
  getStringByPath,
} from "./configurable/jsonPath.js";
import { renderTemplateValue } from "./configurable/template.js";

type ConfigurableHttpTrackerAdapterOptions = {
  configPath: string;
};

export class ConfigurableHttpTrackerAdapter implements TicketSourceAdapter {
  private readonly config: ConfigurableTrackerConfig;

  /**
   * Last known labels by ticket ID.
   *
   * This is useful for APIs where label/tag update replaces the whole list.
   * Example: Yandex Tracker PATCH tags.
   */
  private readonly ticketLabelsCache = new Map<string, string[]>();

  constructor(options: ConfigurableHttpTrackerAdapterOptions) {
    const absolutePath = path.resolve(process.cwd(), options.configPath);
    const raw = fs.readFileSync(absolutePath, "utf8");
    const json = JSON.parse(raw) as unknown;

    const parsed = ConfigurableTrackerConfigSchema.safeParse(json);

    if (!parsed.success) {
      throw new Error(
        `Invalid tracker config ${absolutePath}: ${parsed.error.message}`,
      );
    }

    this.config = parsed.data;

    console.log(
      `[tracker] loaded configurable tracker "${this.config.name}" from ${absolutePath}`,
    );
  }

  async getTicketsList(): Promise<Ticket[]> {
    const operation = this.config.operations.listTickets;

    const responseJson = await this.executeRequest(operation, {});
    const itemsUnknown = getByPath(responseJson, operation.response.itemsPath);

    if (!Array.isArray(itemsUnknown)) {
      throw new Error(
        `listTickets response itemsPath "${operation.response.itemsPath}" did not resolve to array`,
      );
    }

    const tickets = itemsUnknown
      .map((item) => this.mapItemToTicket(item))
      .filter((ticket) => this.applyFilters(ticket));

    for (const ticket of tickets) {
      this.ticketLabelsCache.set(ticket.id, ticket.labels ?? []);
    }

    console.log(`[tracker] configurable adapter returned ${tickets.length} ticket(s)`);

    return tickets;
  }

  async addLabels(input: AddLabelsInput): Promise<void> {
    const operation = this.config.operations.addLabels;

    if (!operation) {
      console.log("[tracker] addLabels operation is not configured, skipping");
      return;
    }

    const existingLabels = this.ticketLabelsCache.get(input.ticketId) ?? [];
    const mappedLabels = input.labels.map((label) => this.mapLabel(label));

    const nextLabels = Array.from(new Set([...existingLabels, ...mappedLabels]));

    this.ticketLabelsCache.set(input.ticketId, nextLabels);

    await this.executeRequest(operation, {
      ticketId: input.ticketId,
      labels: nextLabels,
    });
  }

  async addComment(input: AddCommentInput): Promise<void> {
    const operation = this.config.operations.addComment;

    if (!operation) {
      console.log("[tracker] addComment operation is not configured, skipping");
      return;
    }

    await this.executeRequest(operation, {
      ticketId: input.ticketId,
      comment: input.comment,
    });
  }

  async markProcessed(input: MarkProcessedInput): Promise<void> {
    const operation = this.config.operations.markProcessed;

    if (!operation) {
      console.log("[tracker] markProcessed operation is not configured, skipping");
      return;
    }

    const statusLabels = this.statusToLabels(input.status);
    const existingLabels = this.ticketLabelsCache.get(input.ticketId) ?? [];
    const nextLabels = Array.from(new Set([...existingLabels, ...statusLabels]));

    this.ticketLabelsCache.set(input.ticketId, nextLabels);

    await this.executeRequest(operation, {
      ticketId: input.ticketId,
      labels: nextLabels,
      status: input.status,
      reason: input.reason,
      analysis: input.analysis,
    });
  }

  private mapItemToTicket(item: unknown): Ticket {
    const mapping = this.config.mapping;

    const id = getStringByPath(item, mapping.id);

    if (!id) {
      throw new Error(
        `Mapped ticket id is empty for item: ${JSON.stringify(item)}`,
      );
    }

    const labels = mapping.labels
      ? getStringArrayByPath(item, mapping.labels)
      : [];

    const ticket: Ticket = {
      id,
      title: getStringByPath(item, mapping.title, id),
      description: getStringByPath(item, mapping.description, ""),
      labels,
      attributes: {},
      metadata: {},
    };

    if (mapping.url) {
      if (mapping.url.startsWith("$.")) {
        ticket.url = getStringByPath(item, mapping.url);
      } else {
        ticket.url = String(
          renderTemplateValue(mapping.url, {
            ticketId: id,
            labels,
            ticket: item,
            env: process.env,
          }),
        );
      }
    }

    if (mapping.attributes) {
      for (const [key, valuePathOrLiteral] of Object.entries(
        mapping.attributes,
      )) {
        ticket.attributes![key] = this.mapPathOrLiteral(
          item,
          valuePathOrLiteral,
          {
            ticketId: id,
            labels,
          },
        );
      }
    }

    if (mapping.metadata) {
      for (const [key, valuePathOrLiteral] of Object.entries(
        mapping.metadata,
      )) {
        ticket.metadata![key] = this.mapPathOrLiteral(
          item,
          valuePathOrLiteral,
          {
            ticketId: id,
            labels,
          },
        );
      }
    }

    return ticket;
  }

  private mapPathOrLiteral(
    item: unknown,
    valuePathOrLiteral: string,
    context: {
      ticketId: string;
      labels: string[];
    },
  ): unknown {
    if (valuePathOrLiteral.startsWith("$.")) {
      return getByPath(item, valuePathOrLiteral);
    }

    return renderTemplateValue(valuePathOrLiteral, {
      ticketId: context.ticketId,
      labels: context.labels,
      ticket: item,
      env: process.env,
    });
  }

  private applyFilters(ticket: Ticket): boolean {
    const filters = this.config.filters;

    if (!filters) {
      return true;
    }

    const labels = ticket.labels ?? [];

    if (filters.requiredLabels && filters.requiredLabels.length > 0) {
      const hasRequired = filters.requiredLabels.some((label) =>
        labels.includes(label),
      );

      if (!hasRequired) {
        return false;
      }
    }

    if (filters.excludedLabels && filters.excludedLabels.length > 0) {
      const hasExcluded = filters.excludedLabels.some((label) =>
        labels.includes(label),
      );

      if (hasExcluded) {
        return false;
      }
    }

    return true;
  }

  private async executeRequest(
    operation: HttpRequestConfig,
    context: {
      ticketId?: string;
      labels?: string[];
      comment?: string;
      status?: string;
      reason?: string;
      analysis?: unknown;
    },
  ): Promise<unknown> {
    const renderedUrl = renderTemplateValue(operation.url, {
      ...context,
      env: process.env,
    });

    if (typeof renderedUrl !== "string") {
      throw new Error("Rendered URL is not a string");
    }

    const renderedHeaders = renderTemplateValue(operation.headers ?? {}, {
      ...context,
      env: process.env,
    });

    if (
      typeof renderedHeaders !== "object" ||
      renderedHeaders === null ||
      Array.isArray(renderedHeaders)
    ) {
      throw new Error("Rendered headers must be an object");
    }

    const renderedBody =
      operation.body === undefined
        ? undefined
        : renderTemplateValue(operation.body, {
            ...context,
            env: process.env,
          });

    console.log(`[tracker] ${operation.method} ${renderedUrl}`);

    const response = await fetch(renderedUrl, {
      method: operation.method,
      headers: renderedHeaders as Record<string, string>,
      body:
        renderedBody === undefined ? undefined : JSON.stringify(renderedBody),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Tracker request failed: ${operation.method} ${renderedUrl} -> ${response.status} ${response.statusText}: ${text}`,
      );
    }

    if (!text.trim()) {
      return {};
    }

    return JSON.parse(text);
  }

  private mapLabel(label: string): string {
    return this.config.labelMapping?.[label] ?? label;
  }

  private statusToLabels(status: MarkProcessedInput["status"]): string[] {
    const internalLabelsByStatus: Record<MarkProcessedInput["status"], string[]> =
      {
        llm_candidate: ["ai:processed", "ai:llm-candidate"],
        human_required: ["ai:processed", "ai:human-required"],
        rejected: ["ai:processed", "ai:rejected"],
        failed: ["ai:processed", "ai:failed"],
      };

    return internalLabelsByStatus[status].map((label) => this.mapLabel(label));
  }
}
