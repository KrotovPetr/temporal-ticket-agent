import "dotenv/config";
import { loadConfig } from "../config.js";
import { UniversalLlmClient } from "./universalLlmClient.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (config.llm.provider !== "universal") {
    console.log(
      `[smoke] LLM_PROVIDER=${config.llm.provider}, but smoke test will still use universal config`,
    );
  }

  const client = new UniversalLlmClient({
    apiStyle: config.llm.apiStyle,
    baseUrl: config.llm.baseUrl,
    apiKey: config.llm.apiKey,
    model: config.llm.model,
    promptId: config.llm.promptId,
    headers: config.llm.headers,
  });

  const output = await client.smokeTest(
    "Return short plain text answer: connection is working",
  );

  console.log("LLM output:");
  console.log(output);
}

main().catch((error) => {
  console.error("[smoke:llm] failed:", error);
  process.exit(1);
});
