# {도메인} 구현 계획

> Spec: [spec.md](./spec.md) | 날짜: {날짜}

## 대상 엔드포인트

이번에 구현하는 엔드포인트 (spec.md 의 부분집합):

| Method | Path | 설명 |
|--------|------|------|
| | | |

## 기술 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| | | |

## 애그리거트 매핑

spec.md 의 응답 필드가 어떤 애그리거트에서 나오는지. [ddd-guide.md](../../docs/backend-development-guide/ddd-guide.md) 를 따른다.

- {Aggregate} (루트) → {Repository}
- {Related} → ID 참조

## 구현 순서

1. Repository 인터페이스 (domain 모듈)
2. DTO (api 모듈)
3. Service (api 모듈)
4. Controller (api 모듈)
5. SecurityConfig 수정 (필요 시)
6. 마이그레이션 SQL (필요 시)
7. 테스트 — 통합(성공 + 실패 코어) + 단위(도메인 규칙)
8. FE 연동 (mock → API 교체)

## 의존성

- ERD 변경: 있음 / 없음
- SecurityConfig: permitAll 추가 필요 여부
- 다른 도메인: 의존하는 다른 스펙이 있는가

## 리스크

- {구현 시 주의할 점, 성능 이슈, 데이터 정합성 등}
