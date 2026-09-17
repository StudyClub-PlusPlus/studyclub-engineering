# {도메인} Tasks

> Plan: [plan.md](./plan.md) | Spec: [spec.md](./spec.md)
> 날짜: {날짜}

## 포맷: `[ID] [P?] 설명`

- **[P]**: 병렬 실행 가능 (다른 태스크와 파일이 겹치지 않음)
- Phase 는 의존성 기준. Phase N 이 끝나야 Phase N+1 시작
- 파일 경로를 구체적으로 적는다

---

## Phase 1: Infrastructure

- [ ] T001 {Repository 인터페이스 생성 — 파일 경로}
- [ ] T002 [P] {또 다른 Repository — 파일 경로}

## Phase 2: {기능 이름} ({Method} {Path})

- [ ] T003 {DTO 생성 — 파일 경로}
- [ ] T004 {Service 구현 — 파일 경로}
- [ ] T005 {Controller 엔드포인트 — 파일 경로}
- [ ] T006 {SecurityConfig 수정 — 파일 경로}
- [ ] T007 통합 테스트 — 성공 + {에러 케이스}
- [ ] T008 [P] 단위 테스트 — {도메인 규칙}

## Phase 3: FE 연동

- [ ] T009 {mock → API 교체 — 파일 경로}
- [ ] T010 {에러/로딩 처리 — 파일 경로}

---

## Checkpoint

- [ ] 모든 Phase 완료
- [ ] spec.md 상태를 `구현완료` 로 변경
- [ ] `/spec review {도메인}` 검증 통과
