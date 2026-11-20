#!/usr/bin/env bash
# Stop 훅 (repo-kit) — 이번 턴에 손댄 파일이 속한 워크스페이스만 검사한다.
# 실패하면 결과를 stderr 로 내고 exit 2 — Claude Code 가 멈추지 않고 다음 턴에 고친다.
#
# 레포가 채우는 칸: CHECKS. 한 줄 = "경로접두사|명령" (명령은 레포 루트에서 돈다).
# 손댄 파일 중 경로접두사로 시작하는 것이 있을 때만 그 명령을 돌린다. 비어 있으면 아무것도 안 한다.
#   예) "frontend/apps/web/|pnpm --dir frontend --filter web run typecheck"
#       "backend/|cd backend && ./gradlew -q compileJava"
CHECKS=(
  "frontend/apps/core-front/|pnpm --dir frontend --filter core-front run typecheck"
  "frontend/apps/back-office-front/|pnpm --dir frontend --filter back-office-front run typecheck"
  "frontend/apps/playground/|pnpm --dir frontend --filter playground run typecheck"
  "frontend/packages/ui/|pnpm --dir frontend --filter @studyclub/ui run typecheck"
  "frontend/packages/utils/|pnpm --dir frontend --filter @studyclub/utils run typecheck"
  "frontend/packages/types/|pnpm --dir frontend --filter @studyclub/types run typecheck"
  "backend/|cd backend && ./gradlew -q compileJava compileTestJava"
)

# macOS 기본 bash 3.2 는 set -u 에서 빈 배열을 못 읽어 -u 를 쓰지 않는다
set -o pipefail
[ ${#CHECKS[@]} -eq 0 ] && exit 0

input=$(cat)
# 막은 뒤 다시 멈출 때는 같은 검사를 또 돌리지 않는다
case "$input" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;; esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
changed=$({ git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u)
[ -z "$changed" ] && exit 0

touched() {
  while IFS= read -r f; do
    case "$f" in "$1"*) return 0 ;; esac
  done <<<"$changed"
  return 1
}

report=""
for c in "${CHECKS[@]}"; do
  prefix=${c%%|*} cmd=${c#*|}
  touched "$prefix" || continue
  if ! log=$(bash -c "$cmd" 2>&1); then
    report+="[$prefix] 실패: $cmd"$'\n'"$(printf '%s\n' "$log" | tail -n 40)"$'\n\n'
  fi
done

[ -z "$report" ] && exit 0
printf '이번 턴에 손댄 워크스페이스 검사가 실패했다. 고친 뒤 끝낸다.\n\n%s' "$report" >&2
exit 2
