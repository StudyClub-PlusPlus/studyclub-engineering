---
name: self-review
description: "PR self-review 를 3단계(quick/standard/deep)로 병렬 에이전트 실행하고 .workspace/{PR번호}/ 에 리뷰 파일을 남긴다."
---

# /self-review — PR Self Review

변경된 파일을 병렬 에이전트로 리뷰하고, 결과를 `.workspace/{PR번호}/review.md` 에 남긴다.

## 사용법

```
/self-review                    # standard 레벨, PR 번호 자동 감지
/self-review quick              # quick — 치명적 결함만
/self-review deep               # deep — 전체 코드 품질
/self-review {PR번호}           # PR 번호 지정
/self-review deep {PR번호}      # 레벨 + PR 번호
```

## 레벨

| 레벨 | 범위 | 자동 수정 |
|------|------|-----------|
| **quick** | 치명적 결함만 (보안, 데이터 손실, 크래시) | O (치명적) |
| **standard** | quick + 로직 버그, 에러 핸들링, 네이밍 | O (치명적) |
| **deep** | standard + 성능, 구조, 테스트 커버리지, 스펙 정합성 | O (치명적) |

**치명적 결함은 레벨에 관계없이 무조건 수정한다.**

## 실행 절차

### 1단계: PR 번호 결정

```bash
# 현재 브랜치에서 PR 번호 자동 감지
gh pr view --json number -q .number 2>/dev/null
# 없으면 브랜치명을 PR 식별자로 사용
git branch --show-current
```

PR 번호가 있으면 `{PR번호}`, 없으면 브랜치명을 폴더명으로 쓴다.

### 2단계: 변경 파일 수집

```bash
# PR 이 있으면 PR diff
gh pr diff {PR번호} --name-only
# 없으면 main 대비 diff (untracked 포함)
git diff main --name-only && git ls-files --others --exclude-standard
```

### 3단계: 병렬 에이전트 리뷰

변경된 파일을 **도메인/모듈 기준으로 그룹핑**하고, 그룹당 Agent 를 띄워 **병렬** 리뷰한다.

#### 에이전트 분배 전략

```
변경 파일 목록
├── backend/**  → Agent: "be-review" (Java/Spring 리뷰)
├── frontend/** → Agent: "fe-review" (TS/React 리뷰)
├── specs/**    → Agent: "sdd-review" (스펙 정합성 리뷰)
├── docs/**     → Agent: "docs-review" (문서 정합성)
└── 기타        → Agent: "misc-review"
```

- 파일이 5개 이하면 에이전트 1개로 처리 (오버헤드 > 이득)
- 각 에이전트는 할당된 파일을 Read 로 읽고 리뷰 결과를 `.workspace/{PR번호}/partial/{에이전트명}.md` 에 쓴다
- 모든 에이전트 완료 후 partial 파일을 합쳐서 `review.md` 를 만든다

#### Agent 프롬프트 (각 에이전트에 전달)

각 에이전트는 아래 지시를 받는다:

```
리뷰 대상 파일: {파일 목록}
리뷰 레벨: {quick|standard|deep}
PR 번호: {PR번호}

아래 기준으로 각 파일을 Read 해서 리뷰하라.
결과를 .workspace/{PR번호}/partial/{에이전트명}.md 에 쓴다.

[치명적 결함 기준]
- 시크릿·토큰·API 키 하드코딩 (PUBLIC 레포!)
- SQL injection, XSS, 인증 우회
- 데이터 손실 가능 경로
- NPE / null 접근이 확실한 경로
- 무한 루프 / 무한 재귀
→ 치명적 결함은 직접 Edit 으로 수정한다.

[standard 추가 기준]
- 로직 버그: 조건 반전, off-by-one, 빠진 break/return
- 에러 핸들링: catch 없는 외부 호출, 빈 catch 블록
- 네이밍: 의도를 숨기는 이름
- 하드코딩 매직 넘버

[deep 추가 기준]
- 성능: N+1 쿼리, O(n²) 루프
- 구조: 단일 책임 위반, 거대 메서드 (>50줄), 중복 코드
- 테스트: 변경된 로직에 테스트 존재 여부
```

#### Codex 연동

리뷰 시작 전에 Codex 설치 여부를 확인한다:

```bash
which codex 2>/dev/null
```

Codex 가 있으면:
- 각 에이전트 대신 `codex` 를 호출하여 파일별 리뷰를 실행한다
- `codex "Review this file for {레벨} level issues: {파일경로}"` 형태
- Codex 결과를 파싱해서 동일한 partial 파일 형식으로 저장한다
- Codex 가 없으면 위의 Agent 방식으로 폴백한다

### 4단계: SDD (Spec-Driven Development) 정합성 검사

**모든 레벨**에서 실행한다 (변경 파일에 해당 도메인 코드가 있을 때만).

#### 절차

1. 변경된 파일에서 도메인을 추출한다 (패키지명, 경로에서 유추)
2. `specs/{도메인}/spec.md` 가 있는지 확인한다
3. 있으면 스펙 vs 구현을 대조한다:

| 검사 항목 | 방법 |
|-----------|------|
| URL 일치 | Controller `@RequestMapping` vs spec.md Path |
| DTO 필드 일치 | Response DTO 필드 vs spec.md 응답 표 |
| 에러 코드 일치 | Service 의 BusinessException vs spec.md Error Responses |
| SecurityConfig | permitAll 목록 vs spec.md 인증 여부 |
| 상태 전이 | 엔티티 메서드 vs spec.md / ERD 상태 정의 |

4. **불일치 발견 시**:
   - 구현이 맞고 스펙이 오래된 경우 → **스펙을 수정**한다 (spec.md 직접 Edit)
   - 스펙이 맞고 구현이 틀린 경우 → **구현을 수정**한다
   - 판단 불가 → 🟡 경고로 기록하고 수동 확인 요청

5. 스펙 변경 사항도 `review.md` 에 기록한다:

```markdown
## 📋 SDD 정합성

| 도메인 | 항목 | 상태 | 조치 |
|--------|------|------|------|
| study | URL 일치 | ✅ | — |
| study | DTO 필드 | ⚠️ slug 누락 | spec.md 에서 slug 제거 (FE 미사용) |
```

### 5단계: 리뷰 파일 합산

`.workspace/{PR번호}/partial/*.md` 를 합쳐서 `.workspace/{PR번호}/review.md` 를 만든다.

```markdown
# Self Review — PR #{PR번호}

> 브랜치: {브랜치명}
> 레벨: {quick|standard|deep}
> 날짜: {YYYY-MM-DD}
> 변경 파일: {N}개
> 리뷰 방식: {Agent 병렬|Codex}

## 🔴 치명적 (자동 수정됨)

| 파일 | 라인 | 내용 | 수정 |
|------|------|------|------|
| path/to/file.java | 42 | 하드코딩된 DB 비밀번호 | process.env 참조로 교체 |

## 🟡 경고

| 파일 | 라인 | 내용 | 제안 |
|------|------|------|------|
| path/to/file.java | 15 | 빈 catch 블록 | 로그 추가 또는 rethrow |

## 🟢 참고

- {개선하면 좋지만 필수는 아닌 것}

## 📋 SDD 정합성

| 도메인 | 항목 | 상태 | 조치 |
|--------|------|------|------|
| | | | |

## 요약

- 치명적: {N}건 (모두 수정됨)
- 경고: {N}건
- 참고: {N}건
- SDD 불일치: {N}건 (수정됨: {N}건)
- 판정: ✅ PASS / ⚠️ PASS WITH WARNINGS / ❌ FAIL
```

**판정 기준**:
- `PASS`: 치명적 0 + 경고 ≤ 2
- `PASS WITH WARNINGS`: 치명적 0 (수정 후) + 경고 > 2
- `FAIL`: 치명적이 자동 수정 불가능한 경우 (구조적 보안 결함 등)

### 6단계: 출력

```
🔍 Self Review 완료 — PR #{PR번호} ({레벨})

📄 .workspace/{PR번호}/review.md

🔴 치명적: {N}건 → 모두 수정됨
🟡 경고: {N}건
🟢 참고: {N}건
📋 SDD: {N}건 불일치 → {N}건 수정

판정: {PASS|PASS WITH WARNINGS|FAIL}
```

## 주의사항

- `.workspace/` 는 `.gitignore` 에 등록되어 있다 — 리뷰 파일은 커밋하지 않는다
- 치명적 결함 수정은 별도 커밋으로 남긴다 (메시지: `fix: self-review 치명적 결함 수정`)
- SDD 스펙 수정도 별도 커밋 (메시지: `docs: self-review SDD 정합성 반영`)
- deep 레벨에서 스펙 정합성 검사는 `specs/{도메인}/spec.md` 가 있을 때만
- Codex 가 설치되어 있으면 Codex 우선, 없으면 Agent 병렬로 폴백
