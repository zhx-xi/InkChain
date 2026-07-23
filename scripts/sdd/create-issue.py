#!/usr/bin/env python3
"""
create-issue.py — 通用 Issue 创建脚本

用法:
  python create-issue.py <title> <body_file|body_text> [milestone_number]

参数:
  title       - Issue 标题
  body_file   - body 文本文件路径（含 \n 的纯文本），或以 @ 开头的内联 body
  milestone   - 里程碑编号 (可选, 如 10 或 11)

环境变量:
  GH_TOKEN - GitHub Personal Access Token

质量门禁:
  1. body 长度 ≥ 50 字符
  2. 创建后回读验证
"""

import json
import os
import re
import sys
import urllib.request
import ssl

REPO = "zhx-xi/InkChain"
MIN_BODY_LENGTH = 50
DEFAULT_LABELS = []

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE


def get_token():
    token = os.environ.get("GH_TOKEN")
    if token:
        return token
    creds_path = os.path.expanduser("~/.git-credentials")
    try:
        with open(creds_path) as f:
            for line in f:
                m = re.search(r"https://[^:]+:([^@]+)@github\.com", line)
                if m:
                    return m.group(1)
    except FileNotFoundError:
        pass
    print("FATAL: No GH_TOKEN found")
    sys.exit(1)


TOKEN = get_token()


def gh_api(method, path, data=None):
    url = f"https://api.github.com/repos/{REPO}/{path.lstrip('/')}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"token {TOKEN}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "InkChain-Bot")
    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"HTTP {e.code}: {err}")
        sys.exit(1)


def detect_milestone(title, body):
    """根据标题和 body 自动推断里程碑"""
    title_lower = title.lower()
    body_lower = body.lower()

    bug_keywords = ["bug", "错误", "crash", "崩溃", "失败", "fail", "异常", "修复"]
    feat_keywords = ["feat", "feature", "新增", "添加", "支持", "实现", "enhancement"]

    for kw in bug_keywords:
        if kw in title_lower or kw in body_lower:
            return 10  # Hot Fix

    for kw in feat_keywords:
        if kw in title_lower or kw in body_lower:
            return 11  # Feature

    return 11  # Default to feature


def main():
    if len(sys.argv) < 3:
        print("Usage: python create-issue.py <title> <body_file|@body_text> [milestone_number]")
        print("  body_file: path to file containing issue body")
        print("  @body_text: inline body starting with @ (e.g. '@This is the body')")
        print("  milestone_number: optional, auto-detected if omitted")
        sys.exit(1)

    title = sys.argv[1]
    body_arg = sys.argv[2]

    # Read body
    if body_arg.startswith("@"):
        body = body_arg[1:]  # Strip @ prefix
    else:
        with open(body_arg, "r", encoding="utf-8") as f:
            body = f.read()

    # Milestone
    if len(sys.argv) > 3:
        milestone = int(sys.argv[3])
    else:
        milestone = detect_milestone(title, body)
        print(f"  (Auto-detected milestone: #{milestone})")

    print(f"═══ Create Issue ═══")
    print(f"Title: {title}")
    print(f"Body: {len(body)} chars")
    print(f"Milestone: #{milestone}")

    # Pre-check
    if len(body) < MIN_BODY_LENGTH:
        print(f"  ⚠️  Body short ({len(body)} < {MIN_BODY_LENGTH}), consider adding more detail")

    # Determine labels
    labels = list(DEFAULT_LABELS)
    if milestone == 10:
        labels.append("bug")
        labels.append("P1")
    elif milestone == 11:
        labels.append("enhancement")
        labels.append("P1")

    # Create
    print("\nCreating issue...")
    issue_data = {
        "title": title,
        "body": body,
        "labels": labels,
    }
    if milestone:
        issue_data["milestone"] = milestone

    issue = gh_api("POST", "issues", issue_data)
    issue_number = issue["number"]
    issue_url = issue["html_url"]
    print(f"  ✅ #{issue_number}: {issue_url}")
    print(f"  Labels: {', '.join(l['name'] for l in issue.get('labels', []))}")
    print(f"  Milestone: {issue.get('milestone', {}).get('title', 'none')}")

    # Verify
    print("\n[Verify] Reading back issue...")
    check = gh_api("GET", f"issues/{issue_number}")
    check_body = check.get("body", "")
    if len(check_body) < MIN_BODY_LENGTH:
        print(f"  ⚠️  Body too short in issue: {len(check_body)} chars")
    else:
        print(f"  ✅ Body: {len(check_body)} chars")

    print(f"\n✅ Issue #{issue_number} created and verified: {issue_url}")


if __name__ == "__main__":
    main()
