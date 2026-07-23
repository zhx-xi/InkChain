#!/usr/bin/env python3
"""
SDD Spec 生成器 — 从代码自动提取行为合约、状态矩阵、API 签名生成 spec.md 骨架。

用法:
  python create-spec.py <module-name> <api-route-file> <model-file> [pages...]
  python create-spec.py relations src/api/routes/relations.ts src/models/relations.ts RelationGraphPanel
"""

import re, json, os, sys
from pathlib import Path

INKCHAIN_ROOT = Path(os.environ.get("INKCHAIN_ROOT", "C:/Users/zhx-xi/WorkBuddy/inkos/InkChain"))
SPECS_DIR = INKCHAIN_ROOT / "specs"

def extract_zod_schemas(filepath: Path) -> list[dict]:
    """从 TypeScript 模型文件中提取 Zod schema 定义。"""
    if not filepath.exists():
        return []
    text = filepath.read_text(encoding="utf-8")
    schemas = []
    for m in re.finditer(r"export\s+const\s+(\w+Schema)\s*=\s*z\.(\w+)\((.*?)\)", text, re.DOTALL):
        schemas.append({"name": m.group(1), "type": m.group(2), "body": m.group(3)[:200]})
    for m in re.finditer(r"export\s+const\s+(\w+)\s*=\s*z\.enum\(\[(.*?)\]\)", text, re.DOTALL):
        values = [v.strip().strip("'\"") for v in m.group(2).split(",")]
        schemas.append({"name": m.group(1), "type": "enum", "body": ", ".join(values)})
    return schemas

def extract_api_routes(filepath: Path) -> list[dict]:
    """从 Hono 路由文件中提取 API 签名。"""
    if not filepath.exists():
        return []
    text = filepath.read_text(encoding="utf-8")
    routes = []
    for m in re.finditer(r'(\w+)\.(get|post|patch|delete|put)\("([^"]+)"', text):
        routes.append({"method": m.group(2).upper(), "path": m.group(3), "handler_prefix": m.group(1)})
    return routes

def extract_testids(filepath: Path) -> list[str]:
    """从 E2E 文件中提取 data-testid 引用。"""
    if not filepath.exists():
        return []
    text = filepath.read_text(encoding="utf-8")
    return re.findall(r"data-testid='([^']+)'|data-testid=\"([^\"]+)\"|getByTestId\('([^']+)'", text)

def generate_spec(module_name: str, api_file: str, model_file: str, pages: list[str]) -> str:
    """生成 spec.md 内容。"""
    api_path = INKCHAIN_ROOT / "packages/studio/src/api/routes" / api_file
    model_path = INKCHAIN_ROOT / "packages/core/src/models" / model_file
    
    schemas = extract_zod_schemas(model_path)
    routes = extract_api_routes(api_path)
    
    # Find matching E2E files
    e2e_dir = INKCHAIN_ROOT / "packages/studio/e2e"
    e2e_files = sorted(e2e_dir.glob(f"{module_name}*.spec.ts"))
    testids = []
    for ef in e2e_files:
        testids.extend(extract_testids(ef))
    testids = list(dict.fromkeys(testids))[:15]  # dedupe, limit
    
    title = module_name.replace("-", " ").title()
    
    # Build API table
    api_rows = []
    for r in routes:
        zs = ", ".join(s["name"] for s in schemas[:2]) if schemas else "—"
        api_rows.append(f"| {r['method']} | `{r['path']}` | {zs} | {zs} | — |")
    
    # Build schema table
    schema_rows = []
    for s in schemas:
        schema_rows.append(f"| `{s['name']}` | {s['type']} | {s['body'][:80]} |")
    
    # Build testid table
    testid_rows = []
    for t in testids:
        testid_rows.append(f"| — | `{t}` | — |")
    
    template = SPECS_DIR / "TEMPLATE.md"
    if template.exists():
        content = template.read_text(encoding="utf-8")
    else:
        content = """# {title} — 功能规格书 (SDD)\n\n**版本**: 1.0\n**状态**: draft\n\n## 1. 模块概述\n\n## 2. 行为合约\n\n### 2.1 API 接口\n\n| 方法 | 路径 | 输入 Schema | 输出 Schema | 说明 |\n|------|------|-------------|-------------|------|\n\n### 2.2 数据模型\n\n### 2.3 状态转换\n\n### 2.4 关联约束\n\n## 3. 状态矩阵\n\n## 4. UI 覆盖\n\n### 4.1 页面\n\n### 4.2 data-testid\n\n## 5. 非功能需求\n\n## 6. 验收矩阵\n\n## 7. 变更记录\n"""
    
    content = content.replace("[功能模块名]", title)
    content = content.replace("YYYY-MM-DD", __import__("datetime").date.today().isoformat())
    
    # Insert extracted data into their respective table sections
    if api_rows:
        mark = "| 方法 | 路径 | 输入 | 输出 | 说明 |"
        content = content.replace(mark, mark + "\n" + "\n".join(api_rows))
    
    if schema_rows:
        mark = "### 2.2 数据模型"
        content = content.replace(mark, f"### 2.2 数据模型\n\n| Schema | 类型 | 定义 |\n|--------|------|------|\n" + "\n".join(schema_rows))
    
    if testid_rows:
        mark = "### 4.3 关键 data-testid"
        content = content.replace(mark, f"### 4.3 关键 data-testid\n\n| 元素 | data-testid | 用途 |\n|------|-------------|------|\n" + "\n".join(testid_rows))
    
    if pages:
        page_rows = "\n".join(f"| `{p}` | | | |" for p in pages)
        mark = "### 4.1 页面 / 面板"
        content = content.replace(mark, f"### 4.1 页面 / 面板\n\n| 页面组件 | 路由 | data-testid 前缀 | 说明 |\n|----------|------|------------------|------|\n{page_rows}")
    
    return content

def main():
    if len(sys.argv) < 4:
        print("Usage: python create-spec.py <module-name> <api-route-file> <model-file> [pages...]")
        print("Example: python create-spec.py relations relations.ts relations.ts RelationGraphPanel")
        sys.exit(1)
    
    module_name = sys.argv[1]
    api_file = sys.argv[2]
    model_file = sys.argv[3]
    pages = sys.argv[4:] if len(sys.argv) > 4 else []
    
    spec = generate_spec(module_name, api_file, model_file, pages)
    
    output = SPECS_DIR / f"{module_name}.md"
    output.write_text(spec, encoding="utf-8")
    print(f"✅ Spec created: {output}")
    print(f"   Schemas: {len(extract_zod_schemas(INKCHAIN_ROOT / 'packages/core/src/models' / model_file))}")
    print(f"   Routes:  {len(extract_api_routes(INKCHAIN_ROOT / 'packages/studio/src/api/routes' / api_file))}")

if __name__ == "__main__":
    main()
