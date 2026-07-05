#!/bin/bash
# 推送到 GitHub 并创建 PR
# 用法: bash push-and-pr.sh

set -e

cd "$(dirname "$0")"

export ALL_PROXY=http://127.0.0.1:7890

echo "=== 推送代码 ==="
git push origin 326-agent-team

echo ""
echo "=== 创建 PR ==="
TOKEN="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"

python3 -c "
import json, sys
with open('pr-body.json') as f:
    data = json.load(f)
body = json.dumps(data)
print(body)
" | while read body; do
  curl -s -x http://127.0.0.1:7890 -X POST \
    -H "Authorization: token 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" \
    -H "Accept: application/vnd.github.v3+json" \
    -H "Content-Type: application/json" \
    https://api.github.com/repos/zhx-xi/InkChain/pulls \
    -d "$body"
done

echo ""
echo "=== 评论 Issue #326 ==="
PR_URL=$(curl -s -x http://127.0.0.1:7890 \
  -H "Authorization: token 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" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/zhx-xi/InkChain/pulls?head=zhx-xi:326-agent-team \
  | python3 -c "import sys,json; data=json.load(sys.stdin); print(data[0].get('html_url','') if data else '')")

curl -s -x http://127.0.0.1:7890 -X POST \
  -H "Authorization: token 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" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/zhx-xi/InkChain/issues/326/comments \
  -d "{\"body\": \"已提交 PR: ${PR_URL}\n\n## 变更总结\n- 预设+用户模板合并统一列表\n- [团队配置][流程编辑] Tab切换\n- 修复AgentFlowEditor filter永真bug\n- 暖白文学风配色\n- 自定义Agent CRUD\n- 每个模板独立流程配置\n\n@zhx-xi\"}"

curl -s -x http://127.0.0.1:7890 -X POST \
  -H "Authorization: token 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" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/zhx-xi/InkChain/issues/326/labels \
  -d '{"labels":["pr-submitted"]}'

echo "=== 完成 ==="
