import http from "node:http";
import { z } from "zod";
import { DemoTrackerStore } from "./store.js";

const MarkProcessedSchema = z.object({
  ticketId: z.string(),
  status: z.enum(["llm_candidate", "human_required", "rejected", "failed"]),
  analysis: z
    .object({
      decision: z.enum(["llm", "human", "reject"]),
      confidence: z.number(),
      category: z.enum([
        "docs",
        "test",
        "bugfix",
        "refactor",
        "feature",
        "config",
        "unknown",
      ]),
      estimatedComplexity: z.enum([
        "trivial",
        "small",
        "medium",
        "large",
        "unknown",
      ]),
      risk: z.enum(["low", "medium", "high"]),
      reason: z.string(),
      requiredContext: z.array(z.string()).optional(),
    })
    .optional(),
  reason: z.string().optional(),
});

const AddLabelsSchema = z.object({
  labels: z.array(z.string()),
});

const AddCommentSchema = z.object({
  comment: z.string(),
});

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  const body = JSON.stringify(payload, null, 2);

  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });

  res.end(body);
}

function sendText(
  res: http.ServerResponse,
  statusCode: number,
  text: string,
): void {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
  });

  res.end(text);
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (!raw) return {};

  return JSON.parse(raw);
}

function extractTicketIdFromPath(
  pathname: string,
  suffix: "/processed" | "/labels" | "/comments",
): string | null {
  if (!pathname.startsWith("/tickets/")) return null;
  if (!pathname.endsWith(suffix)) return null;

  const withoutPrefix = pathname.slice("/tickets/".length);
  const idPart = withoutPrefix.slice(0, -suffix.length);

  if (!idPart) return null;

  return decodeURIComponent(idPart);
}

export function startDemoTrackerServer(options: {
  port: number;
}): Promise<http.Server> {
  const store = new DemoTrackerStore();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

      console.log(`[demo-tracker] ${req.method} ${url.pathname}`);

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "GET" && url.pathname === "/tickets") {
        sendJson(res, 200, {
          tickets: store.listPendingTickets(),
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/tickets/all") {
        sendJson(res, 200, {
          tickets: store.listAllTickets(),
        });
        return;
      }

      const processedTicketId = extractTicketIdFromPath(
        url.pathname,
        "/processed",
      );

      if (req.method === "POST" && processedTicketId) {
        const body = await readJsonBody(req);
        const parsed = MarkProcessedSchema.safeParse(body);

        if (!parsed.success) {
          sendJson(res, 400, {
            error: "Invalid request body",
            details: parsed.error.message,
          });
          return;
        }

        if (parsed.data.ticketId !== processedTicketId) {
          sendJson(res, 400, {
            error: "ticketId in path and body do not match",
          });
          return;
        }

        const ticket = store.markProcessed(parsed.data);

        sendJson(res, 200, {
          ok: true,
          ticket,
        });
        return;
      }

      const labelsTicketId = extractTicketIdFromPath(url.pathname, "/labels");

      if (req.method === "POST" && labelsTicketId) {
        const body = await readJsonBody(req);
        const parsed = AddLabelsSchema.safeParse(body);

        if (!parsed.success) {
          sendJson(res, 400, {
            error: "Invalid request body",
            details: parsed.error.message,
          });
          return;
        }

        const ticket = store.addLabels({
          ticketId: labelsTicketId,
          labels: parsed.data.labels,
        });

        sendJson(res, 200, {
          ok: true,
          ticket,
        });
        return;
      }

      const commentTicketId = extractTicketIdFromPath(
        url.pathname,
        "/comments",
      );

      if (req.method === "POST" && commentTicketId) {
        const body = await readJsonBody(req);
        const parsed = AddCommentSchema.safeParse(body);

        if (!parsed.success) {
          sendJson(res, 400, {
            error: "Invalid request body",
            details: parsed.error.message,
          });
          return;
        }

        const ticket = store.addComment({
          ticketId: commentTicketId,
          comment: parsed.data.comment,
        });

        sendJson(res, 200, {
          ok: true,
          ticket,
        });
        return;
      }

      sendJson(res, 404, {
        error: "Not found",
      });
    } catch (error) {
      console.error("[demo-tracker] request failed:", error);

      sendText(
        res,
        500,
        error instanceof Error ? error.message : "Internal server error",
      );
    }
  });

  return new Promise((resolve) => {
    server.listen(options.port, () => {
      console.log(
        `[demo-tracker] listening on http://localhost:${options.port}`,
      );
      console.log(
        `[demo-tracker] pending tickets: http://localhost:${options.port}/tickets`,
      );
      console.log(
        `[demo-tracker] all tickets: http://localhost:${options.port}/tickets/all`,
      );

      resolve(server);
    });
  });
}
