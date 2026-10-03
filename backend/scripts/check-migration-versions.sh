#!/usr/bin/env bash
# Flyway 버전 번호가 겹치는지 본다. 푸시 전에 직접 돌려도 되고, CI 가 PR 마다 돌린다.
#
#   bash backend/scripts/check-migration-versions.sh
#
# ## 왜 필요한가
#
# Flyway 는 파일 **이름**이 아니라 `V` 뒤의 **숫자**로 마이그레이션을 구분한다.
# 두 PR 이 각각 `V26__a.sql` · `V26__b.sql` 을 추가하면
#
#   1. 서로 다른 파일이라 **git 충돌이 안 난다**
#   2. 각 PR 의 CI 는 자기 브랜치 기준이라 **둘 다 통과한다**
#   3. 둘 다 머지되고 나서 **부팅에서 처음 터진다**
#      (`Found more than one migration with version 26`)
#
# 터지는 지점이 "머지 후"라서, 발견하는 사람은 그 충돌을 만든 사람이 아니다.
#
# ## 왜 두 디렉토리를 합쳐서 세나
#
# `application.yml` 의 `flyway.locations` 는 `classpath:db/migration` **하나**인데,
# 거기에 모듈 둘이 기여한다 — `backend/domain` 과 `backend/notification`.
# **디렉토리가 달라도 번호가 겹치면 터진다.** 한 디렉토리만 훑는 검사는 그걸 못 잡는다.
# (2026-10-03 기준 domain V1~V13·V15~V25 + notification V14)
#
# ## bash 3.2 호환
#
# macOS 기본 bash 는 3.2 라서 `mapfile`·`declare -A` 가 없다. 그것들을 쓰면 CI(bash 5)
# 에서는 돌고 **개발자 맥에서는 안 돌아서**, "푸시 전에 직접 돌려라" 가 거짓말이 된다.
# 그래서 연관 배열 대신 `sort | uniq -d` 로 간다.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# build/ 는 제외한다 — 컴파일 산출물이라 src 와 중복돼서 전부 "중복" 으로 잡힌다
find backend -path '*/src/main/resources/db/migration/*' -name 'V*.sql' \
  -not -path '*/build/*' | sort > "$TMP/files"

count=$(wc -l < "$TMP/files" | tr -d ' ')
if [ "$count" -eq 0 ]; then
  echo "✕ 마이그레이션 파일을 못 찾았다. 경로 규약이 바뀌었나?" >&2
  exit 1
fi

fail=0

# 1) 파일명 규약 — V<숫자>__<설명>.sql
#    `V22.1__x.sql` 같은 소수 버전을 허용하면 "늦게 머지하는 쪽이 번호를 올린다" 는
#    규약이 성립하지 않는다(정렬이 사람 직관과 갈린다). 정수만 쓴다.
while IFS= read -r f; do
  case "$(basename "$f")" in
    V[0-9]*__?*.sql)
      # V 뒤가 전부 숫자인지 한 번 더 본다 (V1.1__x.sql 이 위 glob 을 통과한다)
      n=$(basename "$f" | sed -E 's/^V([^_]*)__.*/\1/')
      case "$n" in
        '' | *[!0-9]*)
          echo "✕ 버전이 정수가 아니다: $f" >&2
          echo "    V<숫자>__<설명>.sql 이어야 한다 (소수 버전 금지)" >&2
          fail=1
          ;;
        0?*)
          # Flyway 는 V026 과 V26 을 **같은 26** 으로 본다. 그런데 아래 중복 검사는
          # 문자열로 비교해서 "026" ≠ "26" 으로 통과시킨다 — 검사를 빠져나가는 충돌이
          # 생긴다(2026-10-03 반증 테스트에서 실제로 통과했다). 접두 0 을 금지해서
          # 애초에 그 모양이 들어오지 못하게 한다.
          echo "✕ 버전에 접두 0 이 있다: $f" >&2
          echo "    Flyway 는 V$n 과 V$(echo "$n" | sed 's/^0*//') 를 같은 버전으로 본다." >&2
          fail=1
          ;;
      esac
      ;;
    *)
      echo "✕ 파일명 규약 위반: $f" >&2
      echo "    V<숫자>__<설명>.sql 이어야 한다" >&2
      fail=1
      ;;
  esac
done < "$TMP/files"

# 2) 번호 중복 — 모듈을 **합쳐서** 센다
sed -E 's|.*/V([0-9]+)__.*|\1|' "$TMP/files" | grep -E '^[0-9]+$' | sort -n > "$TMP/versions" || true
sort -n "$TMP/versions" | uniq -d > "$TMP/dups" || true

if [ -s "$TMP/dups" ]; then
  while IFS= read -r v; do
    echo "✕ 버전 V$v 가 두 번 쓰였다 — Flyway 는 숫자로만 구분한다. 부팅에서 터진다." >&2
    grep -E "/V${v}__" "$TMP/files" | sed 's/^/    /' >&2
    echo "    → 늦게 머지하는 쪽이 번호를 올린다." >&2
  done < "$TMP/dups"
  fail=1
fi

if [ "$fail" != 0 ]; then
  echo >&2
  echo "git 충돌이 없었다고 안전한 게 아니다 — Flyway 는 파일명을 안 본다." >&2
  exit 1
fi

# 통과했으면 다음에 쓸 번호를 알려 준다. 중복을 만들기 전에 보는 게 제일 싸다.
latest=$(tail -1 "$TMP/versions")
echo "✓ 마이그레이션 ${count}개 · 번호 중복 없음 · 최신 V${latest} → 다음은 V$((latest + 1))"
