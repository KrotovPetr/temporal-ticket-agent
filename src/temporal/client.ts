import { Client, Connection } from "@temporalio/client";
import type { AppConfig } from "../configTypes.js";

export async function createTemporalClient(config: AppConfig): Promise<Client> {
  const connection = await Connection.connect({
    address: config.temporal.address,
  });

  return new Client({
    connection,
    namespace: config.temporal.namespace,
  });
}
