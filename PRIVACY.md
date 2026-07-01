# InkOS 隐私政策

**最后更新**：2026-07-01

## 1. 概述

InkOS 是一款**本地优先**的开源 AI 写作辅助工具。您的隐私是我们的首要考量。

**核心承诺：InkOS 不收集、不上传、不分享您的任何个人信息或创作内容。** 您的全部数据仅存储在您的本地设备上，完全由您掌控。

## 2. 我们不收集什么

InkOS **不会**收集以下任何信息：

- 个人身份信息（姓名、电子邮件、电话号码、地址等）
- 设备标识符或指纹
- IP 地址或地理位置
- 浏览行为或使用习惯
- Cookie 或追踪数据
- 遥测或分析数据

我们无法访问、查看或收集您在 InkOS 中创作的任何内容。

## 3. 本地存储的数据

以下数据类别**仅存储**在您的本地设备上，不会传输到任何外部服务器：

| 数据类别 | 内容示例 | 存储位置 |
|----------|----------|----------|
| 创作内容 | 小说章节、角色设定、世界观、大纲 | `books/<id>/chapters/` |
| 应用配置 | 写作偏好、界面设置、项目配置 | `inkos.json` |
| API 密钥 | 第三方 AI 服务的访问凭证 | `.inkos/secrets.json` |
| 写作统计 | 字数统计、章节分析、记忆数据 | `story/memory.db`（SQLite 本地数据库） |
| 全局配置 | 环境变量、LLM 提供商设置 | `~/.inkos/.env` |

## 4. 第三方 AI 服务的数据传输

当您使用 AI 写作功能时，**您主动撰写的写作内容**（而非个人信息）将被发送至您自行选择和配置的第三方 AI 服务商（大语言模型 API）。

**您需要了解的关键事实：**

- 发送给 AI 服务商的数据包括：书籍元数据（标题/题材）、章节文本、写作指令、角色信息
- **不会**发送：您的个人身份信息、设备信息、网络信息
- 每个 AI 服务商的数据处理方式不同，我们建议您查阅您所用服务商的隐私政策
- 对于支持"不用于训练"选项的 API（如 OpenAI），InkOS 默认启用 `store: false` 参数

**常用 AI 服务商隐私政策链接：**

- OpenAI: https://openai.com/policies/privacy-policy
- Google Gemini: https://policies.google.com/privacy
- DeepSeek: https://platform.deepseek.com/privacy
- Moonshot: https://www.moonshot.cn/privacy
- Kimi: https://www.moonshot.cn/privacy
- MiniMax: https://www.minimaxi.com/privacy

## 5. 数据安全

### 您的责任
由于所有数据存储在您的本地设备上，数据安全主要取决于您：

- 保护您的设备访问权限
- 定期备份重要创作内容
- 注意 API Key 的存储安全（当前以明文存储在 `.inkos/secrets.json` 中）
- 避免在不安全的网络环境中使用

### 我们建议
- 使用操作系统的密钥链功能管理 API Key
- 定期导出和备份您的书籍项目
- 不要分享 `.inkos/secrets.json` 文件

## 6. 您的权利

由于所有数据存储在本地，您可以随时：

- **访问**：直接在文件系统中查看所有数据
- **导出**：通过书籍导出功能或直接复制文件目录
- **删除**：删除项目目录或特定文件即可完全移除数据
- **控制**：选择是否使用 AI 功能、选择哪个 AI 服务商

## 7. 开源透明性

InkOS 是完全开源的（[AGPL-3.0](LICENSE) 许可证）。您可以自行审查源代码，验证我们确实没有实施任何数据收集或上传机制。

源代码仓库：https://github.com/Narcooo/inkos

## 8. 政策更新

我们可能会不时更新本隐私政策。重大变更将通过以下方式通知：

- GitHub 仓库的 Release Notes
- 代码中的 CHANGELOG.md

## 9. 联系我们

如有隐私相关问题，请通过以下方式联系：

- **GitHub Issues**：[提交 Issue](https://github.com/Narcooo/inkos/issues)
- **安全漏洞报告**：请参阅 [SECURITY.md](SECURITY.md)

---

**InkOS — 您的故事，您的数据，您的掌控。**
