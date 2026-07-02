// ── Dialogue Simulator (Issue #94 — AI-4) ──
//
// Allows users to simulate character dialogues within voice constraints.
// Builds a character voice profile from character descriptions + persona settings,
// then manages multi-turn dialogue state.

import type { CharacterVoiceProfile } from "../models/voice-profile.js";

// ── Dialogue Config ──

export interface DialogueSimConfig {
  /** Character ID for the first speaker */
  characterId: string;
  /** Optional persona ID to apply additional voice constraints */
  personaId?: string;
  /** Scenario/scene description */
  scenario: string;
  /** Creativity temperature (0-2, default 0.8) */
  temperature: number;
  /** Max tokens per response */
  maxTokens: number;
}

export const DEFAULT_DIALOGUE_CONFIG: DialogueSimConfig = {
  characterId: "",
  scenario: "",
  temperature: 0.8,
  maxTokens: 500,
};

// ── Dialogue Turn ──

export interface DialogueTurn {
  speaker: string;
  speakerId: string;
  text: string;
  timestamp: string;
}

export interface DialogueSession {
  id: string;
  config: DialogueSimConfig;
  turns: DialogueTurn[];
  createdAt: string;
}

// ── Character Voice Builder ──

export interface VoiceConstraints {
  tone: string[];
  speechPatterns: string[];
  vocabularyStyle: string;
  catchphrases: string[];
  formality: "formal" | "casual" | "mixed";
}

/**
 * Build voice constraints from a character description and optional voice profile.
 */
export function buildVoiceConstraints(
  characterDescription: string,
  voiceProfile?: CharacterVoiceProfile,
): VoiceConstraints {
  const tone: string[] = [];
  const speechPatterns: string[] = [];
  const catchphrases: string[] = [];
  let formality: "formal" | "casual" | "mixed" = "mixed";
  let vocabularyStyle = "";

  // Extract from character description
  const desc = characterDescription.toLowerCase();

  // Tone detection
  if (/温柔|温和|平和/.test(desc)) tone.push("gentle");
  if (/强硬|严厉|坚毅/.test(desc)) tone.push("firm");
  if (/活泼|开朗|调皮/.test(desc)) tone.push("lively");
  if (/高傲|冷漠|孤僻/.test(desc)) tone.push("aloof");
  if (/热情|豪爽/.test(desc)) tone.push("passionate");
  if (/严肃|正经/.test(desc)) tone.push("serious");

  // Speech patterns
  if (/结巴|口吃/.test(desc)) speechPatterns.push("stutter");
  if (/慢|沉稳/.test(desc)) speechPatterns.push("slow");
  if (/快|急促/.test(desc)) speechPatterns.push("rapid");
  if (/礼貌|客气/.test(desc)) {
    speechPatterns.push("polite");
    formality = "formal";
  }

  // Formality
  if (/粗鲁|粗俗|不羁/.test(desc)) formality = "casual";
  if (/文雅|文绉绉/.test(desc)) formality = "formal";

  // Vocabulary style
  if (/古老|古典/.test(desc)) vocabularyStyle = "classical";
  if (/现代|当代/.test(desc)) vocabularyStyle = "modern";
  if (/黑话|江湖/.test(desc)) vocabularyStyle = "slang";

  // If voice profile exists, overlay its settings
  if (voiceProfile) {
    if (voiceProfile.tone) tone.push(voiceProfile.tone);
    if (voiceProfile.speechPattern) speechPatterns.push(voiceProfile.speechPattern);
    if (voiceProfile.catchphrases) catchphrases.push(...voiceProfile.catchphrases);
    if (voiceProfile.formality === "formal" || voiceProfile.formality === "casual") {
      formality = voiceProfile.formality;
    }
  }

  return {
    tone: [...new Set(tone)].slice(0, 3),
    speechPatterns: [...new Set(speechPatterns)],
    vocabularyStyle: vocabularyStyle || "neutral",
    catchphrases: [...new Set(catchphrases)].slice(0, 5),
    formality,
  };
}

// ── System Prompt Builder ──

/**
 * Build a system prompt section that constrains dialogue generation
 * to match the character's voice.
 */
export function buildDialogueSystemPrompt(
  characterName: string,
  constraints: VoiceConstraints,
  scenario: string,
): string {
  const parts: string[] = [];
  parts.push(`你现在正在扮演 "${characterName}"，请完全以该角色的身份和口吻说话。`);

  if (constraints.tone.length > 0) {
    parts.push(`语气: ${constraints.tone.join("、")}`);
  }

  if (constraints.formality === "formal") {
    parts.push("用语应当正式、礼貌。");
  } else if (constraints.formality === "casual") {
    parts.push("用语应当随意、口语化。");
  }

  if (constraints.vocabularyStyle === "classical") {
    parts.push("使用古典文雅的词汇。");
  } else if (constraints.vocabularyStyle === "slang") {
    parts.push("使用口语化和江湖黑话。");
  }

  if (constraints.speechPatterns.length > 0) {
    parts.push(`说话特点: ${constraints.speechPatterns.join("、")}`);
  }

  if (constraints.catchphrases.length > 0) {
    parts.push(`口头禅: ${constraints.catchphrases.join("、")}`);
  }

  if (scenario) {
    parts.push(`场景设定: ${scenario}`);
  }

  parts.push("请只输出角色台词，不要包含动作描述或旁白。");

  return parts.join("\n");
}

// ── Multi-turn dialogue state management ──

export function createDialogueSession(
  config: DialogueSimConfig,
): DialogueSession {
  return {
    id: `dialogue-${Date.now().toString(36)}`,
    config,
    turns: [],
    createdAt: new Date().toISOString(),
  };
}

export function addTurn(
  session: DialogueSession,
  speaker: string,
  speakerId: string,
  text: string,
): DialogueSession {
  return {
    ...session,
    turns: [
      ...session.turns,
      {
        speaker,
        speakerId,
        text,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Build the full message history for API calls.
 */
export function buildDialogueMessages(
  systemPrompt: string,
  turns: DialogueTurn[],
  maxHistory: number = 20,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Include recent turns (limited to maxHistory)
  const recentTurns = turns.slice(-maxHistory);
  for (const turn of recentTurns) {
    messages.push({
      role: "user",
      content: `${turn.speaker}: ${turn.text}`,
    });
  }

  return messages;
}

/**
 * Export dialogue turns as chapter material.
 */
export function exportDialogueAsMaterial(
  turns: DialogueTurn[],
  format: "raw" | "script" | "novel" = "novel",
): string {
  if (format === "raw") {
    return turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
  }

  if (format === "script") {
    return turns.map((t) => `${t.speaker}\n${t.text}\n`).join("\n");
  }

  // novel format (default)
  return turns
    .map((t) => `「${t.text}」${t.speaker}`)
    .join("\n\n");
}
