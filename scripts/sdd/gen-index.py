#!/usr/bin/env python3
"""
gen-index.py — 从 .report.md 文件生成 INDEX.md

用法:
  python gen-index.py [--specs-dir <path>]
"""
import re, os, sys
from pathlib import Path
from datetime import date

INKCHAIN_ROOT = Path(os.environ.get(
    "INKCHAIN_ROOT",
    os.environ.get("GITHUB_WORKSPACE", str(Path(__file__).resolve().parent.parent.parent))
))

specs_dir = INKCHAIN_ROOT / "specs"

modules = []
for spec_file in sorted(specs_dir.glob("*.md")):
    if spec_file.stem in ("TEMPLATE", "INDEX", "COMPARISON") or spec_file.name.endswith(".report.md"):
        continue
    report_file = spec_file.with_suffix(".report.md")
    if report_file.exists():
        text = report_file.read_text(encoding="utf-8")
        pct = 0
        level = "N/A"
        for line in text.split("\n"):
            m = re.search(r"=\s*([\d.]+)%", line)
            if m and "符合度" in line:
                pct = int(float(m.group(1)))
            if "等级" in line:
                if "🔴" in line: level = "🔴"
                elif "🟡" in line: level = "🟡"
                elif "🟢" in line: level = "🟢"
                elif "⚪" in line: level = "⚪"
        # Extract API count from report
        api_section = ""
        if "## 1." in text and "## 2." in text:
            api_section = text.split("## 1.")[1].split("## 2.")[0]
        apis = len(re.findall(r"GET|POST|PATCH|DELETE|PUT", api_section))
        modules.append((spec_file.stem, pct, level, apis))

modules.sort(key=lambda x: -x[1])

lines = [
    "# InkChain SDD 规格文件索引",
    "",
    f"**生成日期**: {date.today().isoformat()}",
    f"**规格总数**: {len(modules)} 个功能模块",
    f"**验证脚本**: `scripts/sdd/verify-spec.py`",
    "",
    "---",
    "",
    "## 符合度一览",
    "",
    "| # | 模块 | 符合度 | 等级 | API 数量 |",
    "|---|------|--------|------|----------|",
]

green = yellow = red = 0
for i, (name, pct, level, apis) in enumerate(modules, 1):
    lines.append(f"| {i} | **{name}** | {pct}% | {level} | {apis} |")
    if pct >= 80: green += 1
    elif pct >= 50: yellow += 1
    else: red += 1

avg = sum(m[1] for m in modules) // len(modules) if modules else 0

lines.extend([
    "",
    "---",
    "",
    "## 统计",
    "",
    "| 等级 | 数量 | 说明 |",
    "|------|------|------|",
    f"| 🟢 大部分符合 (≥80%) | {green} | |",
    f"| 🟡 部分符合 (50-79%) | {yellow} | 主力修复区 |",
    f"| 🔴 严重不符 (<50%) | {red} | 优先修复 |",
    f"| **平均符合度** | **{avg}%** | |",
    "",
    "---",
    "",
    "## 行动计划",
    "",
    "### P0 — 优先修复 (<50%)",
    "",
])
for name, pct, level, _ in modules:
    if pct < 50:
        lines.append(f"- **{name}** ({pct}%) — 需补全行为合约、状态矩阵、验收矩阵")

lines.extend(["", "### P1 — 本期完善 (50-79%)", ""])
for name, pct, level, _ in modules:
    if 50 <= pct < 80:
        lines.append(f"- **{name}** ({pct}%) — 补全 gap 项")

lines.extend(["", "### P2 — 维持优化 (≥80%)", ""])
for name, pct, level, _ in modules:
    if pct >= 80:
        lines.append(f"- **{name}** ({pct}%) — 保持合规度")

output = specs_dir / "INDEX.md"
output.write_text("\n".join(lines), encoding="utf-8")
print(f"INDEX.md regenerated: {output}")
print(f"Green: {green}, Yellow: {yellow}, Red: {red}, Avg: {avg}%")
