// ── Voice Profile Schema (C3-1) ──
// Defines the character voice profile: speech style, personality traits,
// catchphrases, tone, vocabulary preferences, avoidance words, and sample dialogues.

import { z } from "zod";

// ── Schema ──

export const VoiceProfileSchema = z.object({
  characterId: z.string().min(1),
  speechStyle: z.string().default("现代口语"),
  personality: z.array(z.string()).default([]),
  catchphrases: z.array(z.string()).default([]),
  tone: z.string().default("温和"),
  vocabulary: z.array(z.string()).default([]),
  avoidance: z.array(z.string()).default([]),
  sampleDialogues: z.array(z.string()).default([]),
  updatedAt: z.number().int().nonnegative(),
});

export const VoiceProfilesFileSchema = z.object({
  profiles: z.record(z.string(), VoiceProfileSchema), // characterId -> profile
  version: z.number().default(1),
});

// ── Types ──

export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;
export type VoiceProfilesFile = z.infer<typeof VoiceProfilesFileSchema>;

// ── Preset Templates ──

export const VOICE_PRESETS: Record<string, Partial<VoiceProfile>> = {
  "ancient-scholar": {
    speechStyle: "文绉绉",
    personality: ["博学", "严谨", "含蓄"],
    tone: "温和",
    vocabulary: ["窃以为", "然则", "何以见得", "诚哉斯言"],
    avoidance: ["网络用语"],
    sampleDialogues: ["窃以为此事尚有商榷之余地。"],
  },
  "modern-youth": {
    speechStyle: "现代口语",
    personality: ["活泼", "直率", "新潮"],
    tone: "轻松",
    catchphrases: ["绝了", "真的假的", "我直接无语"],
    vocabulary: ["卷", "躺平", "摆烂", "破防"],
    avoidance: ["古文"],
    sampleDialogues: ["这也太绝了吧！"],
  },
  "martial-hero": {
    speechStyle: "江湖豪迈",
    personality: ["豪爽", "重义气", "果断"],
    tone: "豪迈",
    catchphrases: ["哈哈哈", "痛快", "好汉"],
    vocabulary: ["江湖", "义气", "一剑", "痛快"],
    avoidance: ["扭捏之词"],
    sampleDialogues: ["哈哈哈，今日与诸位痛饮三百杯！"],
  },
  "court-noble": {
    speechStyle: "典雅高贵",
    personality: ["优雅", "城府", "从容"],
    tone: "沉稳",
    vocabulary: ["本宫", "陛下", "臣以为"],
    avoidance: ["粗俗用语"],
    sampleDialogues: ["此事本宫自有主张。"],
  },
};
