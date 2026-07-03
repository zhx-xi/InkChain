import { z } from "zod";

export const AgentRoleConfigSchema = z.object({
  role: z.string(),          // writer, architect, planner, editor, auditor, observer, reviser
  enabled: z.boolean().default(true),
  model: z.string().optional(),  // 覆盖模型
  systemPromptOverride: z.string().optional(),
});

export const AgentTeamConfigSchema = z.object({
  schemaVersion: z.literal("1"),
  agents: z.array(AgentRoleConfigSchema),
  defaultModel: z.string().optional(),
  collaborationMode: z.enum(["sequential", "parallel", "hybrid"]).default("sequential"),
});

export type AgentTeamConfig = z.infer<typeof AgentTeamConfigSchema>;
