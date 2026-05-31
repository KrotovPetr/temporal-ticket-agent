import "dotenv/config";
import { loadConfig } from "../config.js";
import { ConfigurableHttpTrackerAdapter } from "./configurableHTTPTrackerAdapter.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.tracker.configPath) {
    throw new Error("TRACKER_CONFIG_PATH is required");
  }

  const adapter = new ConfigurableHttpTrackerAdapter({
    configPath: config.tracker.configPath,
  });

  const tickets = await adapter.getTicketsList();

  console.log(`Fetched ${tickets.length} ticket(s)`);

  for (const ticket of tickets.slice(0, 10)) {
    console.log({
      id: ticket.id,
      title: ticket.title,
      labels: ticket.labels,
      url: ticket.url,
      attributes: ticket.attributes,
      metadata: ticket.metadata,
    });
  }
}

main().catch((error) => {
  console.error("[smoke:tracker] failed:", error);
  process.exit(1);
});
