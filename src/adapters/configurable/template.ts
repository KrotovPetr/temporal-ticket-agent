import { getByPath } from "./jsonPath.js";

type RenderContext = {
  ticketId?: string;
  labels?: string[];
  comment?: string;
  status?: string;
  reason?: string;
  analysis?: unknown;
  ticket?: unknown;
  env: NodeJS.ProcessEnv;
};

function resolveVariable(name: string, context: RenderContext): unknown {
  if (name.startsWith("$env.")) {
    return context.env[name.slice("$env.".length)] ?? "";
  }

  if (name === "ticketId") return context.ticketId;
  if (name === "labels") return context.labels;
  if (name === "comment") return context.comment;
  if (name === "status") return context.status;
  if (name === "reason") return context.reason;
  if (name === "analysis") return context.analysis;

  if (name.startsWith("analysis.")) {
    return getByPath(context.analysis, `$.${name.slice("analysis.".length)}`);
  }

  if (name.startsWith("ticket.")) {
    return getByPath(context.ticket, `$.${name.slice("ticket.".length)}`);
  }

  return "";
}

export function renderTemplateValue(
  value: unknown,
  context: RenderContext,
): unknown {
  if (typeof value === "string") {
    return renderTemplateString(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => renderTemplateValue(item, context));
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = renderTemplateValue(nestedValue, context);
    }

    return result;
  }

  return value;
}

export function renderTemplateString(
  template: string,
  context: RenderContext,
): unknown {
  const exactMatch = template.match(/^{{\s*([^}]+)\s*}}$/);

  if (exactMatch) {
    return resolveVariable(exactMatch[1].trim(), context);
  }

  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, rawName: string) => {
    const value = resolveVariable(rawName.trim(), context);

    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    return JSON.stringify(value);
  });
}
