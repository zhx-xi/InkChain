import json, os, re, urllib.request, ssl

REPO = "zhx-xi/InkChain"
os.environ["ALL_PROXY"] = "http://127.0.0.1:7890"

creds = os.path.expanduser("~/.git-credentials")
with open(creds) as f:
    for line in f:
        m = re.search(r"https://[^:]+:([^@]+)@github.com", line)
        if m: TOKEN = m.group(1); break

# Ignore SSL cert issues with proxy
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

def gh(m, p, d=None):
    url = f"https://api.github.com/repos/{REPO}/{p.lstrip('/')}"
    b = json.dumps(d, ensure_ascii=False).encode("utf-8") if d else None
    r = urllib.request.Request(url, data=b, method=m)
    r.add_header("Authorization", f"token {TOKEN}")
    r.add_header("Content-Type", "application/json; charset=utf-8")
    r.add_header("User-Agent", "InkChain-Bot")
    return json.loads(urllib.request.urlopen(r, context=ssl_ctx).read())

issues = [
    {
        "title": "[优化] 索引层 — 全局 IndexManager 加速数据读取",
        "body": """## 背景
当前 API 路由直接通过 `fs.readFile` + `JSON.parse` 读取数据文件（worlds、foreshadowing、skills 等）。重复读取同一文件会反复触发磁盘 I/O 和 JSON 解析。

项目已有 `MemoryDB`（`packages/core/src/state/memory-db.ts`）用于 facts/chapters/hooks 的 SQLite 索引，但只用在 truth-files 场景。

## 目标
新建全局 `IndexManager`，为所有命名空间（worlds、foreshadowing、skills、personas 等）提供内存索引缓存，复用现有 MemoryDB 或独立的 LRU Map。

## 方案
```
当前: API → fs.readFile(".inkos/worlds/xxx.json") → JSON.parse → 返回
优化: API → IndexManager.get("worlds", id) → 命中缓存 → 返回
```

### 核心设计
- `packages/core/src/state/index-manager.ts` — 新建文件
- 采用 write-through 策略：写操作同时更新 JSON 文件 + 内存缓存
- 用 LRU Map（`max: 200`）避免内存无限制增长
- 启动时不预加载，首次访问时加载（lazy load）

### 改造范围
- `api/routes/worlds.ts` — `fs.readFile` → `index.get("worlds", id)`
- `api/routes/foreshadowing.ts` — 同上
- `api/routes/skills.ts` — 同上
- `api/routes/personas.ts` — 同上
- `api/routes/style-profiles.ts` — 同上
- `api/routes/voice-profiles.ts` — 同上
- `api/routes/agent-team.ts` — 同上
- `api/routes/agent-templates.ts` — 同上

### 不变的部分
- 主存储仍是 JSON 文件（Git 友好，LLM 可读）
- 索引层是透明的加速层，不影响现有数据结构

## 验收标准
- [ ] `IndexManager` 单例实现，支持 `get/set/evict` 操作
- [ ] 上述 8 个 API 路由改为通过 IndexManager 读写
- [ ] write-through：修改后 JSON 文件 + 缓存同时更新
- [ ] 单元测试：覆盖 LRU 淘汰、缓存命中、write-through
- [ ] 不影响现有 E2E 测试（接口行为不变）""",
        "labels": ["enhancement", "P1"],
        "milestone": 11,
    },
    {
        "title": "[优化] 数据目录迁移 — .inkos/ → .inkchain/",
        "body": """## 背景
项目已从 InkOS 改名 InkChain，但运行时数据目录仍叫 `.inkos/`，不一致。

## 目标
将数据目录从 `.inkos/` 迁移到 `.inkchain/`，分阶段渐进迁移，不破坏现有用户数据。

## 方案

### 阶段 A: 兼容双目录
API 启动时检查：
- 如果 `.inkchain/` 存在 → 使用 `.inkchain/`
- 否则 fallback 到 `.inkos/`

所有代码中的路径引用改为读取一个常量 `DATA_DIR`，由启动逻辑决定值。

### 阶段 B: 自动迁移
API 启动时：
- 如果 `.inkos/` 存在且 `.inkchain/` 不存在 → 自动复制 `.inkos/` → `.inkchain/`，写入 `.inkchain/.migration-complete` 标记
- 然后统一用 `.inkchain/`

### 阶段 C: 清理（1 周后）
- 移除 `.inkos/` fallback 逻辑
- 删除自动迁移代码（已无 `.inkos/` 用户）

## 涉及文件（约 20 处引用）

| 文件 | 引用数 |
|---|---|
| `api/routes/worlds.ts` | 3 |
| `api/routes/personas.ts` | 3 |
| `api/routes/skills.ts` | 2 |
| `api/routes/agent-team.ts` | 2 |
| `api/routes/agent-templates.ts` | 2 |
| `api/routes/custom-agents.ts` | 2 |
| `api/routes/agent-order.ts` | 2 |
| `api/routes/foreshadowing.ts` | 1 |
| `api/routes/style-profiles.ts` | 1 |
| `api/routes/voice-profiles.ts` | 1 |
| `api/routes/session-tags.ts` | 1 |
| `api/routes/publish.ts` | 1 |
| `api/routes/audit.ts` | 1 |
| `api/server.ts` | 1 |
| 前端组件（ServiceConfigSourceCard、ProjectSettings 等） | 3 |

## 验收标准
- [ ] 定义 `DATA_DIR` 常量，所有路径引用统一使用
- [ ] 阶段 A 实现：双目录兼容逻辑
- [ ] 阶段 B 实现：自动迁移 + 标记
- [ ] 新旧目录下 API 行为一致
- [ ] 不影响现有 E2E 测试
- [ ] test-project 同步更新目录名""",
        "labels": ["enhancement", "P1"],
        "milestone": 11,
    },
]

for i in issues:
    r = gh("POST", "issues", {"title": i["title"], "body": i["body"], "labels": i["labels"], "milestone": i["milestone"]})
    print(f"✅ #{r['number']}: {r['title']}")

print("\nDone!")
