// ── AI Persona Generation Route (Per-7) ──
// Provides AI-assisted persona generation from natural language descriptions.
// Users describe their writing style/preferences, and AI recommends configurations
// for all 7 Agent roles.
//
// Routes:
//   POST /api/v1/project/ai-gen/persona  — Generate persona recommendations
//   POST /api/v1/project/ai-gen/persona/apply — Apply a specific agent recommendation

import { Hono } from "hono";
import { createLLMClient, chatCompletion, loadProjectConfig } from "@actalk/inkchain-core";
import {
  PersonaConfigSchema,
  AgentRoleEnum,
  type AgentRole,
  type PersonaConfig,
} from "@actalk/inkchain-core/models/persona-config.js";

// ── Route factory ──

interface RouteDeps {
  readonly getProjectRoot: () => string;
}

export function createPersonaAIGenRouter(deps: RouteDeps): Hono {
  const app = new Hono();

  // POST /ai-gen/persona — Generate AI persona recommendations
  app.post("/ai-gen/persona", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "请求体不是有效的 JSON" } }, 400);
    }

    const description = typeof (body as Record<string, unknown>).description === "string"
      ? (body as Record<string, unknown>).description!.trim()
      : "";

    if (!description) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "描述文本不能为空" } }, 400);
    }

    const root = deps.getProjectRoot();
    const config = await loadProjectConfig(root, { consumer: "studio", requireApiKey: false });

    // ── Construct AI prompt ──
    const systemPrompt = `你是一位资深小说创作顾问和 AI 人格配置专家。

你的任务是根据用户输入的写作风格描述，为 7 个不同的 AI Agent 角色分别推荐 Persona 配置。

7 个 Agent 角色分别是：
1. **Writer**（写手）— 负责章节正文创作
2. **Auditor**（审计员）— 负责连贯性检查
3. **Editor**（编辑）— 负责文字润色
4. **Architect**（架构师）— 负责故事架构
5. **Planner**（规划师）— 负责章节节奏规划
6. **Observer**（观察者）— 负责叙事状态追踪
7. **Reviser**（修订者）— 负责内容修订

请严格按照以下 JSON 格式返回推荐配置（7 个角色都必须包含）：

\`\`\`json
{
  "recommendations": {
    "writer": {
      "displayName": "推荐的角色名",
      "personalityTraits": ["特质1", "特质2", "特质3"],
      "dialogueStyle": {
        "tone": "语气描述",
        "rhythm": "节奏描述",
        "vocabulary": "词汇偏好"
      },
      "behaviorConstraints": [
        { "rule": "规则描述", "style": "Always", "priority": 5, "enabled": true }
      ],
      "freeTextDetails": "详细描述该 Agent 在此风格下的角色设定和行为指导"
    },
    "auditor": { ... },
    "editor": { ... },
    "architect": { ... },
    "planner": { ... },
    "observer": { ... },
    "reviser": { ... }
  }
}
\`\`\`

要求：
- 每个角色的配置必须贴合用户描述的写作风格和题材
- personalityTraits 用 2-4 个标签描述核心特质
- behaviorConstraints 最少 2 条，最多 5 条
- freeTextDetails 用自然语言详细描述角色的定位和工作方式（200-500 字）
- 返回纯 JSON，不要 markdown 包装`;

    const userPrompt = `## 用户描述 / User Description

${description}

请为 7 个 Agent 角色分别推荐合适的 Persona 配置。`;

    try {
      const client = createLLMClient(config.llm);
      const response = await chatCompletion(client, config.llm.model, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ], { temperature: 0.7, maxTokens: 8192 });

      const text = response.content.trim();

      // Try to extract JSON from the response
      let recommendations: Record<string, unknown> | null = null;

      // Try parsing as-is first
      try {
        const parsed = JSON.parse(text);
        recommendations = parsed.recommendations ?? parsed;
      } catch {
        // Try extracting from markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1].trim());
            recommendations = parsed.recommendations ?? parsed;
          } catch {
            // Try finding any JSON object
            const objMatch = text.match(/\{[\s\S]*"recommendations"[\s\S]*\}/);
            if (objMatch) {
              try {
                const parsed = JSON.parse(objMatch[0]);
                recommendations = parsed.recommendations ?? parsed;
              } catch {
                // Last resort: find any JSON object
                const fallbackMatch = text.match(/\{[\s\S]*\}/);
                if (fallbackMatch) {
                  try {
                    recommendations = JSON.parse(fallbackMatch[0]);
                  } catch {
                    // Give up
                  }
                }
              }
            }
          }
        }
      }

      if (!recommendations) {
        return c.json({
          error: { code: "PARSE_ERROR", message: "AI 返回的格式无法解析" },
          raw: text.substring(0, 2000),
        }, 422);
      }

      // Validate each role's configuration
      const validated: Record<string, unknown> = {};
      const errors: Array<{ role: string; message: string }> = [];
      let validCount = 0;

      for (const role of AgentRoleEnum.options as readonly AgentRole[]) {
        const raw = recommendations[role] as Record<string, unknown> | undefined;
        if (!raw) {
          errors.push({ role, message: "缺少配置" });
          continue;
        }
        try {
          const merged = { ...raw, agentRole: role };
          const config = PersonaConfigSchema.parse(merged);
          validated[role] = config;
          validCount++;
        } catch (e) {
          errors.push({ role, message: e instanceof Error ? e.message : String(e) });
        }
      }

      return c.json({
        recommendations: validated,
        validCount,
        totalRoles: AgentRoleEnum.options.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      return c.json({
        error: { code: "LLM_ERROR", message: err instanceof Error ? err.message : String(err) },
      }, 500);
    }
  });

  return app;
}
