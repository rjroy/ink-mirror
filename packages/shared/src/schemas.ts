import { z } from "zod";

// --- Operation discovery schemas ---

export const OperationParameterSchema = z.object({
  name: z.string(),
  description: z.string(),
  required: z.boolean(),
  type: z.enum(["string", "number", "boolean"]),
});

export const OperationDefinitionSchema = z.object({
  operationId: z.string(),
  name: z.string(),
  description: z.string(),
  invocation: z.object({
    method: z.string(),
    path: z.string(),
  }),
  hierarchy: z.object({
    root: z.string(),
    feature: z.string(),
  }),
  parameters: z.array(OperationParameterSchema).optional(),
  idempotent: z.boolean(),
});

export const HelpTreeNodeSchema: z.ZodType<HelpTreeNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    description: z.string().optional(),
    operations: z.array(OperationDefinitionSchema).optional(),
    children: z.record(z.string(), HelpTreeNodeSchema).optional(),
  }),
);

export type OperationParameter = z.infer<typeof OperationParameterSchema>;
export type OperationDefinition = z.infer<typeof OperationDefinitionSchema>;
export type HelpTreeNode = {
  name: string;
  description?: string;
  operations?: OperationDefinition[];
  children?: Record<string, HelpTreeNode>;
};

// --- API response schemas ---

export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

export const ApiSuccessSchema = z.object({
  ok: z.literal(true),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiSuccess = z.infer<typeof ApiSuccessSchema>;
