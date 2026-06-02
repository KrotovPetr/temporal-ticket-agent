import OpenAI from "openai";
import { z } from "zod";
import type { LlmApiStyle } from "../configTypes.js";
import type { Ticket, TicketAnalysis } from "../types.js";
import type { LlmClient } from "./llmClient.js";
import { buildAnalyzeTicketPrompt } from "./prompts.js";

const TicketAnalysisSchema = z.object({
  decision: z.enum(["llm", "human", "needs_context", "reject"]),
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

type UniversalLlmClientOptions = {
  apiStyle: LlmApiStyle;
  baseUrl: string;
  apiKey?: string;
  model?: string;
  promptId?: string;
  headers?: Record<string, string>;
};

export class UniversalLlmClient implements LlmClient {
  private readonly client: OpenAI;

  constructor(private readonly options: UniversalLlmClientOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey ?? "unused",
      baseURL: options.baseUrl,
      defaultHeaders: options.headers,
    });
  }

  async analyzeTicket(ticket: Ticket): Promise<TicketAnalysis> {
    try {
      const prompt = buildAnalyzeTicketPrompt(ticket);
      const outputText = await this.callModel(prompt);

      if (!outputText.trim()) {
        return this.fallback("LLM returned empty output.");
      }

      const json = this.extractJson(outputText);
      const parsedUnknown = JSON.parse(json);
      const parsed = TicketAnalysisSchema.safeParse(parsedUnknown);

      if (!parsed.success) {
        return this.fallback(
          `LLM output JSON validation failed: ${parsed.error.message}. Raw output: ${outputText}`,
        );
      }

      return parsed.data;
    } catch (error) {
      return this.fallback(
        `LLM analysis failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async smokeTest(input: string): Promise<string> {
    return this.callModel(input);
  }

  private async callModel(input: string): Promise<string> {
    if (this.options.apiStyle === "responses") {
      return this.callResponsesApi(input);
    }

    if (this.options.apiStyle === "responses-raw") {
      return this.callResponsesRawApi(input);
    }

    return this.callChatCompletionsApi(input);
  }

  private async callResponsesApi(input: string): Promise<string> {
    const payload: Parameters<typeof this.client.responses.create>[0] = {
      input,
    };

    if (this.options.promptId) {
      payload.prompt = {
        id: this.options.promptId,
      };
    }

    if (this.options.model) {
      payload.model = this.options.model;
    }

    const response = await this.client.responses.create(payload);

    return response.output_text ?? "";
  }

  private async callResponsesRawApi(input: string): Promise<string> {
    if (!this.options.model) {
      throw new Error("LLM_MODEL is required for responses-raw API style");
    }

    const baseUrl = this.options.baseUrl.replace(/\/$/, "");
    const url = `${baseUrl}/responses`;

    const body: Record<string, unknown> = {
      model: this.options.model,
      input,
    };

    if (this.options.promptId) {
      body.prompt = { id: this.options.promptId };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey ?? "unused"}`,
        ...this.options.headers,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `LLM responses-raw request failed: ${response.status} ${response.statusText}: ${text}`,
      );
    }

    const json = JSON.parse(text) as { output_text?: string };

    return json.output_text ?? "";
  }

  private async callChatCompletionsApi(input: string): Promise<string> {
    if (!this.options.model) {
      throw new Error("LLM_MODEL is required for chat-completions API style");
    }

    const response = await this.client.chat.completions.create({
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
          content: input,
        },
      ],
    });

    return response.choices[0]?.message?.content ?? "";
  }

  private extractJson(text: string): string {
    const trimmed = text.trim();

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed;
    }

    const fencedJsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (fencedJsonMatch?.[1]) {
      return fencedJsonMatch[1].trim();
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }

    throw new Error(`Could not extract JSON from model output: ${text}`);
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
