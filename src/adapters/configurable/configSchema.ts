import { z } from "zod";

const HttpMethodSchema = z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]);

const HttpRequestConfigSchema = z.object({
  method: HttpMethodSchema,
  url: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

const ListTicketsOperationSchema = HttpRequestConfigSchema.extend({
  response: z.object({
    itemsPath: z.string(),
  }),
});

export const ConfigurableTrackerConfigSchema = z.object({
  name: z.string(),

  operations: z.object({
    listTickets: ListTicketsOperationSchema,
    addLabels: HttpRequestConfigSchema.optional(),
    addComment: HttpRequestConfigSchema.optional(),
    markProcessed: HttpRequestConfigSchema.optional(),
  }),

  mapping: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    url: z.string().optional(),
    labels: z.string().optional(),
    attributes: z.record(z.string()).optional(),
    metadata: z.record(z.string()).optional(),
  }),

  filters: z
    .object({
      requiredLabels: z.array(z.string()).optional(),
      excludedLabels: z.array(z.string()).optional(),
    })
    .optional(),

  labelMapping: z.record(z.string()).optional(),
});

export type ConfigurableTrackerConfig = z.infer<
  typeof ConfigurableTrackerConfigSchema
>;

export type HttpRequestConfig = z.infer<typeof HttpRequestConfigSchema>;
