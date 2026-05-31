import { z } from "zod";
import type { LlmClient } from "./llmClient.js";
import { buildAnalyzeTicketPrompt } from "./prompts.js";
import type { Ticket, TicketAnalysis } from "../types.js";

const TicketAnalysisSchema = z.object({
  decision: z.enum(["llm", "human", "reject"]),
  confidence: z.number().min(0).max(1),
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
});

type OpenAiCompatibleClientOptions = {
  baseUrl: string;
  apiKey?: string;
  model: string;
};

export class OpenAiCompatibleClient implements LlmClient {
  constructor(private readonly options: OpenAiCompatibleClientOptions) {}

  async analyzeTicket(ticket: Ticket): Promise<TicketAnalysis> {
    try {
      const response = await fetch(
        `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.options.apiKey
              ? { Authorization: `Bearer ${this.options.apiKey}` }
              : {}),
          },
          body: JSON.stringify({
            model: this.options.model,
            temperature: 0,
            messages: [
              {
                role: "system",
                content:
                  "You are a careful software engineering triage assistant. Return strict JSON only.",
              },
              {
                role: "user",
                content: buildAnalyzeTicketPrompt(ticket),
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();

        return this.fallback(
          `LLM request failed with status ${response.status}: ${body}`,
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return this.fallback("LLM response does not contain message content.");
      }

      const parsedJson = JSON.parse(content);
      const parsed = TicketAnalysisSchema.safeParse(parsedJson);

      if (!parsed.success) {
        return this.fallback(
          `LLM JSON validation failed: ${parsed.error.message}`,
        );
      }

      return parsed.data;
    } catch (error) {
      return this.fallback(
        `LLM analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private fallback(reason: string): TicketAnalysis {
    return {
      decision: "human",
      confidence: 0,
      category: "unknown",
      estimatedComplexity: "unknown",
      risk: "high",
      reason,
      requiredContext: [],
    };
  }
}
