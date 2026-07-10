/**
 * Mock LLM Helper — E2E 真实 LLM 模式开关
 *
 * 设置环境变量 INKCHAIN_E2E_REAL_LLM=1 可跳过所有 AI 提取端点 Mock,
 * 让 E2E 测试真实调用 LLM API（需要配置对应 API Key）。
 *
 * 默认不设置该变量，所有 AI 提取使用 page.route() Mock 数据。
 */

/** 当前 E2E 运行模式 */
export function isRealLLMMode(): boolean {
  return process.env.INKCHAIN_E2E_REAL_LLM === "1";
}

/**
 * 根据当前模式条件执行 Mock。
 * 在 Mock 模式下（默认），执行 callback 注册 route handler。
 * 在真实 LLM 模式下，跳过 Mock，让 API 请求直达后端。
 */
export function conditionalMock(
  callback: () => Promise<unknown> | void,
): void {
  if (!isRealLLMMode()) {
    void callback();
  }
}
