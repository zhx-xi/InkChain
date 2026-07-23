#!/usr/bin/env python3
"""
SDD 验证器 — 对照 spec.md 检查代码实现是否符合规格。
输出符合度报告：已完成 / 部分 / 未完成 / 无。

用法:
  python verify-spec.py <spec-file>
  python verify-spec.py specs/relations.md
"""

import re, json, os, sys
from pathlib import Path
from typing import Optional

INKCHAIN_ROOT = Path(os.environ.get(
    "INKCHAIN_ROOT",
    os.environ.get("GITHUB_WORKSPACE", str(Path(__file__).resolve().parent.parent.parent))
))

def parse_spec(spec_path: Path) -> dict:
    """解析 spec.md 成为结构化数据。"""
    text = spec_path.read_text(encoding="utf-8")
    
    result = {
        "module": spec_path.stem,
        "apis": [],
        "schemas": [],
        "testids": [],
        "matrix": [],
        "acceptance": [],
        "pages": [],
    }
    
    # 提取 API
    for m in re.finditer(r"\|\s*(GET|POST|PATCH|DELETE|PUT)\s*\|\s*`([^`]+)`\s*\|", text):
        result["apis"].append({"method": m.group(1), "path": m.group(2)})
    
    # 提取 Schema
    for m in re.finditer(r"\|\s*`(\w+Schema)`\s*\|\s*(\w+)\s*\|", text):
        result["schemas"].append({"name": m.group(1), "type": m.group(2)})
    
    # 提取 data-testid
    for m in re.finditer(r"`([a-z]+-[a-z-]+)`", text):
        tid = m.group(1)
        if "-" in tid and any(kw in tid for kw in ["btn", "list", "container", "input", "msg", "panel", "card"]):
            result["testids"].append(tid)
    
    # 提取验收矩阵
    section = re.search(r"## 6\. 验收矩阵(.*?)(?:## 7\.|\Z)", text, re.DOTALL)
    if section:
        for m in re.finditer(r"\|\s*(\d+)\s*\|\s*(.*?)\s*\|", section.group(1)):
            result["acceptance"].append({"id": m.group(1), "item": m.group(2).strip()})
    
    # 提取页面
    for m in re.finditer(r"\|\s*`(\w+)`\s*\|.*\|.*\|", text):
        if m.group(1)[0].isupper():  # Component names are PascalCase
            result["pages"].append(m.group(1))
    
    return result

def check_api_exists(spec_api: dict) -> tuple[bool, str]:
    """检查 API 路由是否在代码中存在。"""
    method = spec_api["method"]
    path = spec_api["path"]
    
    routes_dir = INKCHAIN_ROOT / "packages/studio/src/api/routes"
    for rf in routes_dir.glob("*.ts"):
        content = rf.read_text(encoding="utf-8")
        if path in content and method.lower() in content.lower():
            return True, f"Found in {rf.name}"
    
    # Also check index.ts / server.ts
    server = INKCHAIN_ROOT / "packages/studio/src/api/index.ts"
    if server.exists():
        content = server.read_text(encoding="utf-8")
        if path in content:
            return True, "Found in index.ts"
    
    return False, "Not found"

def check_schema_exists(spec_schema: dict) -> tuple[bool, str]:
    """检查 Zod schema 是否在 models 中存在。"""
    name = spec_schema["name"]
    models_dir = INKCHAIN_ROOT / "packages/core/src/models"
    for mf in models_dir.glob("*.ts"):
        if mf.name.startswith("__"):
            continue
        content = mf.read_text(encoding="utf-8")
        if f"export const {name}" in content or f"export const {name}:" in content:
            return True, f"Found in {mf.name}"
    return False, "Not found"

def check_testid_exists(testid: str) -> tuple[bool, str]:
    """检查 data-testid 是否在代码中使用。"""
    studio_src = INKCHAIN_ROOT / "packages/studio/src"
    for ts_file in studio_src.rglob("*.tsx"):
        content = ts_file.read_text(encoding="utf-8")
        if testid in content:
            return True, f"Found in {ts_file.relative_to(INKCHAIN_ROOT)}"
    return False, "Not found"

def check_e2e_coverage(spec: dict) -> tuple[int, int, list[str]]:
    """检查 E2E 测试覆盖情况。"""
    e2e_dir = INKCHAIN_ROOT / "packages/studio/e2e"
    module = spec["module"]
    e2e_files = list(e2e_dir.glob(f"{module}-*.spec.ts")) + list(e2e_dir.glob(f"{module}*.spec.ts"))
    
    total_acceptance = len(spec["acceptance"])
    covered = 0
    gaps = []
    
    for e2f in e2e_files:
        content = e2f.read_text(encoding="utf-8")
        for ac in spec["acceptance"]:
            if ac["item"][:20] in content or any(kw in content for kw in ac["item"].split()[:3]):
                covered += 1
    
    for ac in spec["acceptance"]:
        found = False
        for e2f in e2e_files:
            if ac["item"][:20] in e2f.read_text(encoding="utf-8"):
                found = True
                break
        if not found:
            gaps.append(f"#{ac['id']} {ac['item'][:40]}")
    
    return total_acceptance, covered, gaps

def verify_spec(spec_path: str) -> str:
    """主验证逻辑，返回 Markdown 报告。"""
    sp = Path(spec_path)
    if not sp.exists():
        return f"❌ Spec file not found: {spec_path}"
    
    spec = parse_spec(sp)
    lines = [f"# SDD 验证报告: {spec['module']}", f"\n**Spec**: {spec_path}", f"**日期**: {__import__('datetime').date.today().isoformat()}", "\n---\n"]
    
    # 1. API 验证
    lines.append("## 1. API 接口验证\n")
    api_ok = api_fail = 0
    for api in spec["apis"]:
        ok, detail = check_api_exists(api)
        if ok: api_ok += 1
        else: api_fail += 1
        lines.append(f"| {api['method']} `{api['path']}` | {'✅' if ok else '❌'} | {detail} |")
    lines.append(f"\n**结果**: {api_ok}/{api_ok+api_fail} 通过\n")
    
    # 2. Schema 验证
    lines.append("## 2. 数据模型验证\n")
    schema_ok = schema_fail = 0
    for sch in spec["schemas"]:
        ok, detail = check_schema_exists(sch)
        if ok: schema_ok += 1
        else: schema_fail += 1
        lines.append(f"| `{sch['name']}` | {'✅' if ok else '❌'} | {detail} |")
    lines.append(f"\n**结果**: {schema_ok}/{schema_ok+schema_fail} 通过\n")
    
    # 3. TestID 验证
    lines.append("## 3. data-testid 验证\n")
    tid_ok = tid_fail = 0
    for tid in spec["testids"][:10]:
        ok, detail = check_testid_exists(tid)
        if ok: tid_ok += 1
        else: tid_fail += 1
        lines.append(f"| `{tid}` | {'✅' if ok else '❌'} | {detail} |")
    lines.append(f"\n**结果**: {tid_ok}/{tid_ok+tid_fail} 找到\n")
    
    # 4. E2E 覆盖
    lines.append("## 4. E2E 测试覆盖\n")
    total, covered, gaps = check_e2e_coverage(spec)
    lines.append(f"**验收项**: {total} | **有 E2E 覆盖**: {covered} | **覆盖率**: {covered/total*100:.0f}%" if total else "**验收项**: 暂无")
    if gaps:
        lines.append("\n**Gaps**:")
        for g in gaps[:5]:
            lines.append(f"- {g}")
    
    # 5. 总评
    total_checks = api_ok + api_fail + schema_ok + schema_fail + tid_ok + tid_fail
    total_ok = api_ok + schema_ok + tid_ok
    lines.append(f"\n---\n## 5. 总评\n")
    
    if total_checks == 0:
        lines.append("**符合度**: N/A（无 API/无 Schema/纯 UI 模块）")
        lines.append("**等级**: ⚪ 不适用（需手动审查 UI 组件存在性）")
    else:
        lines.append(f"**符合度**: {total_ok}/{total_checks} = {total_ok/total_checks*100:.0f}%")
        level = "🔴 严重不符" if total_ok/total_checks < 0.5 else "🟡 部分符合" if total_ok/total_checks < 0.8 else "🟢 大部分符合"
        lines.append(f"**等级**: {level}")
    
    return "\n".join(lines)

def main():
    if len(sys.argv) < 2:
        print("Usage: python verify-spec.py <spec-file>")
        print("Example: python verify-spec.py specs/relations.md")
        sys.exit(1)
    
    report = verify_spec(sys.argv[1])
    output = Path(sys.argv[1]).with_suffix(".report.md")
    output.write_text(report, encoding="utf-8")
    print(f"✅ Report saved: {output}")
    print()
    # Also print summary
    for line in report.split("\n"):
        if "符合度" in line or "等级" in line:
            print(line)

if __name__ == "__main__":
    main()
