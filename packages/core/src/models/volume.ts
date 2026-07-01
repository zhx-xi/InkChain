import { z } from "zod";

export const VolumeStatusSchema = z.enum(["draft", "active", "completed"]);
export type VolumeStatus = z.infer<typeof VolumeStatusSchema>;

export const VolumeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "卷名称不能为空"),
  description: z.string().default(""),
  status: VolumeStatusSchema.default("draft"),
  order: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Volume = z.infer<typeof VolumeSchema>;
