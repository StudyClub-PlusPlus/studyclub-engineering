#!/usr/bin/env bash
# 실제 Git 기준 ref를 가진 임시 저장소에서 버전 검사 성공·실패를 검증한다.
set -euo pipefail

checker="$(cd "$(dirname "$0")" && pwd)/check-migration-versions.sh"
fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT
mkdir -p "$fixture/backend/scripts" "$fixture/backend/domain/src/main/resources/db/migration"
cp "$checker" "$fixture/backend/scripts/"
cd "$fixture"
git init -q
git config user.name 'Migration Test'
git config user.email 'migration-test@example.com'
migrations=backend/domain/src/main/resources/db/migration
printf 'SELECT 1;\n' > "$migrations/V1__initial.sql"
printf 'SELECT 49;\n' > "$migrations/V49__released.sql"
git add .
git -c commit.gpgsign=false commit -qm 'released migrations'
git update-ref refs/heads/main HEAD

check() {
  env GITHUB_ACTIONS=false MIGRATION_BASELINE_REF=main \
    bash backend/scripts/check-migration-versions.sh > "$fixture/result.log" 2>&1
}

expect_failure() {
  if check; then
    echo "✕ 실패해야 하는 검사가 통과했다: $1" >&2
    exit 1
  fi
  if ! grep -Fq "$2" "$fixture/result.log"; then
    cat "$fixture/result.log" >&2
    exit 1
  fi
  echo "✓ $1"
}

check
echo '✓ 운영 파일만 있으면 통과'
printf 'SELECT 50;\n' > "$migrations/V50__new.sql"
check
echo '✓ 운영 최신보다 큰 새 버전은 통과'
printf 'SELECT 48;\n' > "$migrations/V48__late.sql"
expect_failure '늦게 들어온 낮은 버전 차단' '운영 최신 V49보다 커야 한다'
rm "$migrations/V48__late.sql"
printf 'SELECT 50;\n' > "$migrations/V50__duplicate.sql"
expect_failure '중복 버전 차단' '버전 V50 가 두 번 쓰였다'
rm "$migrations/V50__duplicate.sql"
printf 'SELECT 999;\n' > "$migrations/V49__released.sql"
expect_failure '이미 배포된 SQL 수정 차단' '운영 마이그레이션을 변경·삭제할 수 없다'
rm "$migrations/V49__released.sql"
expect_failure '이미 배포된 SQL 삭제 차단' '운영 마이그레이션을 변경·삭제할 수 없다'
