# API Specs — StudyClub++

> 가이드: [spec-driven-development.md](../docs/backend-development-guide/spec-driven-development.md)

## 도메인 목록

| 도메인 | 폴더 | 상태 | 설명 |
|--------|------|------|------|
| 스터디 | [study/](./study/) | 구현중 | 스터디 목록·상세·북마크·신청 |
| 회원 | [account/](./account/) | — | 인증·프로필·온보딩 |
| 제안 | [proposal/](./proposal/) | — | 스터디 제안·관심 표시 |

## 도메인 외 스펙

API 도메인이 아닌 것(인프라·운영). 구조는 같되 엔드포인트 스펙 대신 설계를 담는다.

| 스펙 | 폴더 | 상태 | 설명 |
|------|------|------|------|
| 관측 스택 | [observability-stack/](./observability-stack/) | 1단계 구현 | 로그(Grafana+Loki+Alloy) → 메트릭·알림은 후속 |

> `—` = 아직 스펙 없음. 필요할 때 `_templates/` 에서 복사해서 시작한다.

## 빠른 시작

```bash
# 새 도메인 스펙 시작
mkdir -p specs/{도메인}
cp specs/_templates/spec-template.md specs/{도메인}/spec.md

# Claude Code 에서
/spec {도메인}           # 초안 자동 생성
/spec plan {도메인}      # 구현 계획 생성
/spec tasks {도메인}     # 태스크 도출
/spec review {도메인}    # 검증
```
