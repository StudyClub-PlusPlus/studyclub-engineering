#!/usr/bin/env bash
# .github/labels.yml 의 라벨 정의를 GitHub 에 반영한다 (생성 또는 갱신, 멱등).
#
#   ./.github/scripts/sync-labels.sh [owner/repo]
#
# 필요 권한: 해당 레포 labels 쓰기 (gh auth login 된 상태).
# 이 스크립트는 라벨을 지우지 않는다 — 제거는 의도치 않은 라벨 유실을 막기 위해 수동으로 한다.
set -euo pipefail

REPO="${1:-StudyClub-PlusPlus/studyclub-engineering}"
FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/labels.yml"

[ -f "$FILE" ] || { echo "labels.yml 을 찾을 수 없다: $FILE" >&2; exit 1; }

# labels.yml 은 아래 3줄 평면 구조만 사용한다. 파서를 의존성 없이 유지하기 위한 제약이므로
# 중첩 구조를 넣지 말 것 (넣으려면 이 파서도 함께 고쳐야 한다).
#   - name: "..."
#     color: "..."
#     description: "..."
parse() {
  awk '
    function emit() { if (name != "") printf "%s\t%s\t%s\n", name, color, desc }
    /^- name:/        { emit(); name=$0; sub(/^- name: *"?/,"",name); sub(/"[[:space:]]*$/,"",name); color=""; desc="" }
    /^[[:space:]]+color:/       { color=$0; sub(/^[[:space:]]*color: *"?/,"",color); sub(/"[[:space:]]*$/,"",color) }
    /^[[:space:]]+description:/ { desc=$0;  sub(/^[[:space:]]*description: *"?/,"",desc);  sub(/"[[:space:]]*$/,"",desc) }
    END               { emit() }
  ' "$FILE"
}

created=0; updated=0
while IFS=$'\t' read -r name color desc; do
  [ -n "$name" ] || continue
  if gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null 2>&1; then
    echo "  + $name"; created=$((created+1))
  else
    gh label edit "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null
    echo "  ~ $name"; updated=$((updated+1))
  fi
done < <(parse)

echo "생성 ${created}개 · 갱신 ${updated}개 → ${REPO}"
