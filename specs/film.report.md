# SDD 验证报告: film

**Spec**: specs/film.md
**日期**: 2026-07-23

---

## 1. API 接口验证

| POST `/:id/map/generate` | ✅ | Found in maps-ai-gen.ts |
| POST `/:id/map/confirm` | ✅ | Found in maps-ai-gen.ts |
| POST `/:id/map/image-analyze` | ✅ | Found in maps-ai-gen.ts |
| GET `/api/v1/xxx` | ❌ | Not found |

**结果**: 3/4 通过

## 2. 数据模型验证

| `XxxSchema` | ❌ | Not found |
| `PlayActionKindSchema` | ✅ | Found in play.ts |
| `PlayActionIntentSchema` | ✅ | Found in play.ts |
| `PlayEntityTypeSchema` | ✅ | Found in play.ts |
| `PlayEntitySchema` | ✅ | Found in play.ts |
| `PlayVisibilitySchema` | ✅ | Found in play.ts |
| `PlayEdgeSchema` | ✅ | Found in play.ts |
| `PlayStateSlotKindSchema` | ✅ | Found in play.ts |
| `PlayStateSlotSchema` | ✅ | Found in play.ts |
| `PlayTimeAdvanceSchema` | ✅ | Found in play.ts |
| `PlayEvidenceStatusSchema` | ✅ | Found in play.ts |
| `PlayEvidenceTransitionSchema` | ✅ | Found in play.ts |
| `PlayEventSchema` | ✅ | Found in play.ts |
| `PlayMutationSchema` | ✅ | Found in play.ts |
| `PlayActionKindSchema` | ✅ | Found in play.ts |
| `PlayEntityTypeSchema` | ✅ | Found in play.ts |
| `PlayStateSlotKindSchema` | ✅ | Found in play.ts |
| `PlayEvidenceStatusSchema` | ✅ | Found in play.ts |

**结果**: 17/18 通过

## 3. data-testid 验证

| `xxx-btn-create` | ❌ | Not found |
| `xxx-list-container` | ❌ | Not found |
| `xxx-msg-error` | ❌ | Not found |

**结果**: 0/3 找到

## 4. E2E 测试覆盖

**验收项**: 6 | **有 E2E 覆盖**: 0 | **覆盖率**: 0%

**Gaps**:
- #1 创建操作正常流程通过
- #2 必填校验正确拦截
- #3 空数据时显示空状态
- #4 API 异常时降级 UI 显示
- #5 删除前确认对话框

---
## 5. 总评

**符合度**: 20/25 = 80%
**等级**: 🟢 大部分符合