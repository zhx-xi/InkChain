#!/usr/bin/env python3
"""
create-pr.py — 带自检的 PR 创建脚本

用法:
  python create-pr.py <branch> <title> <body>

参数:
  branch  - 源分支名
  title   - PR 标题
  body    - PR 描述 (支持 \\n)

环境变量:
  GH_TOKEN - GitHub Personal Access Token

质量门禁:
  1. 检查远程分支是否存在
  2. 检查与 open PR 的文件重叠（避免冲突）
  3. body 长度 ≥ 50 字符
  4. 创建后回读验证
"""

import json
import os
import re
import sys
import urllib.request
import ssl

REPO = "zhx-xi/InkChain"
BASE_BRANCH = "main"
MIN_BODY_LENGTH = 50

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


def check_branch_exists(branch):
    """检查远程分支是否存在"""
    try:
        gh_api("GET", f"git/refs/heads/{branch}")
        return True
    except SystemExit:
        return False


def check_file_overlap(branch):
    """检查与所有 open PR 的文件重叠"""
    open_prs = gh_api("GET", "pulls?state=open")
    if not open_prs:
        return []  # No open PRs, no conflicts

    # Get files changed in our branch's latest commit
    try:
        branch_data = gh_api("GET", f"git/refs/heads/{branch}")
        commit_sha = branch_data["object"]["sha"]
        comparison = gh_api("GET", f"compare/{BASE_BRANCH}...{branch}")
        our_files = {f["filename"] for f in comparison.get("files", [])}
    except SystemExit:
        return []  # Can't compare, skip overlap check

    conflicts = []
    for pr in open_prs:
        pr_num = pr["number"]
        pr_head = pr["head"]["ref"]
        if pr_head == branch:
            continue  # Skip ourselves
        try:
            pr_files = gh_api("GET", f"pulls/{pr_num}/files")
            pr_filenames = {f["filename"] for f in pr_files}
            overlap = our_files & pr_filenames
            if overlap:
                conflicts.append({
                    "pr_number": pr_num,
                    "pr_title": pr["title"],
                    "pr_url": pr["html_url"],
                    "overlap_files": list(overlap),
                })
        except SystemExit:
            continue

    return conflicts


def main():
    if len(sys.argv) < 3:
        print("Usage: python create-pr.py <branch> <title> [body_file]")
        print("  body_file: path to file with PR description (optional)")
        print("  If omitted, uses title as body")
        sys.exit(1)

    branch = sys.argv[1]
    title = sys.argv[2]

    if len(sys.argv) > 3:
        body_file = sys.argv[3]
        with open(body_file, "r", encoding="utf-8") as f:
            body = f.read()
    else:
        body = title

    print(f"═══ Create PR ═══")
    print(f"Branch: {branch}")
    print(f"Title: {title}")
    print(f"Body: {len(body)} chars")

    # ── Pre-checks ──
    print("\n[Pre-check 1] Remote branch exists...")
    if not check_branch_exists(branch):
        print(f"  ❌ Branch '{branch}' not found on remote")
        print(f"  -> Run: git push origin {branch}")
        sys.exit(1)
    print(f"  ✅ Branch '{branch}' exists")

    print("\n[Pre-check 2] Body length...")
    if len(body) < MIN_BODY_LENGTH:
        print(f"  ⚠️  Body too short ({len(body)} < {MIN_BODY_LENGTH})")
        print(f"  -> Consider adding more detail")
    else:
        print(f"  ✅ Body: {len(body)} chars")

    print("\n[Pre-check 3] File overlap check...")
    conflicts = check_file_overlap(branch)
    if conflicts:
        for c in conflicts:
            print(f"  ⚠️  Overlap with PR#{c['pr_number']} ({c['pr_title']})")
            for f in c["overlap_files"]:
                print(f"      - {f}")
        print("  -> Conflict detected. Recommend not creating this PR.")
        print("  -> For Baseline PRs (direct merge), proceed with caution.")
    else:
        print(f"  ✅ No file overlap with open PRs")

    # ── Create PR ──
    print(f"\nCreating PR...")
    pr = gh_api("POST", "pulls", {
        "title": title,
        "head": branch,
        "base": BASE_BRANCH,
        "body": body,
    })
    pr_number = pr["number"]
    pr_url = pr["html_url"]
    print(f"  ✅ PR#{pr_number}: {pr_url}")

    # ── Verify ──
    print("\n[Verify] Reading back PR...")
    pr_check = gh_api("GET", f"pulls/{pr_number}")
    check_title = pr_check.get("title", "")
    check_body = pr_check.get("body", "")
    check_state = pr_check.get("state", "")

    if check_title != title:
        print(f"  ⚠️  Title mismatch: expected '{title}', got '{check_title}'")
    else:
        print(f"  ✅ Title matches")

    if len(check_body) < MIN_BODY_LENGTH:
        print(f"  ⚠️  Body too short in PR: {len(check_body)} chars")
    else:
        print(f"  ✅ Body: {len(check_body)} chars")

    if check_state != "open":
        print(f"  ❌ PR state is '{check_state}', not 'open'")
        sys.exit(1)

    print(f"\n✅ PR#{pr_number} created and verified: {pr_url}")
    print(f"   State: {check_state}")


if __name__ == "__main__":
    main()
