---
name: prototype
description: "유저스토리 하나의 playground 프로토타입을 생성·수정하고, PR 전에 그 프로토타입을 근거로 Story PRD 와 API 스펙을 갱신한다. prototype-agent 스킬 규약을 따른다."
---

# /prototype — 유저스토리 프로토타입 → 문서

한 유저스토리의 playground 프로토타입을 만들거나 고치고, **PR 올리기 전에** 그 프로토타입을 근거로 문서를 맞춘다.
규약의 정본은 [prototype-agent](https://github.com/StudyClub-PlusPlus/prototype-agent) 의 `SKILL.md` 와 `references/prd-guide.md` 다.
작업 전에 둘 다 읽는다.

## 사용법

```
/prototype {USER_STORY}
```

`{USER_STORY}` 는 정규문장 그대로 받는다. 목록은 [`01-planning/_registry/stories.md`](../../01-planning/_registry/stories.md) 의 유저스토리 표다.

```
/prototype 네비게이터로서, 스터디별 공지를 등록할 수 있다.
```

## 전제

- **단건 모드**로 동작한다. 이 레포에는 `01-planning/_registry/` 가 없다 — `ST-###`·`IA-###`·`SRC-####` 를 쓰지 않는다
- Story 폴더 이름(`{story-name}`)은 kebab-case, `{actor}-{행동}` (예: `crew-edit-profile`, `captain-publish-study`)
- 표에 이미 PRD 가 걸린 Story 면 **수정**, `—` 면 **생성**이다

## 1. 프로토타입 생성·수정

위치: `frontend/apps/playground/src/`

| 관객 | 화면 | 공용 컴포넌트 |
| --- | --- | --- |
| 크루 (사용자 사이트) | `app/(proto)/proto/core/[locale]/…/page.tsx` | `proto/core/` |
| 캡틴 (운영 콘솔) | `app/(proto)/proto/console/…/page.tsx` | `proto/console/` |
| 네비게이터 · 캡틴 (사용자 사이트 스터디 관리) | `app/(proto)/proto/core/[locale]/my/joined/[id]/manage/…` | `proto/core/` |

1. 기존 화면이 이 Story 를 담을 수 있으면 그 화면을 고친다. 새 지면은 기존 지면에 자리가 없을 때만 만든다
2. 데이터는 `@studyclub/mock` 을 쓴다. 실 API 교체 지점에 `// TODO(api): {METHOD} {path}` 를 단다
   - **스터디를 가리키는 주소 값은 `study_id`(STUDY.ID) 다** — 경로의 `[id]` 도 `study_id` 다.
     mock 스터디의 문자열 `id` 는 신청·북마크·출석 저장용 내부 키라 URL 에 넣지 않는다
3. **번호별 명세를 `spec.ts` 로 같은 폴더에 둔다** — 프로토타입의 필수 산출물이다
   - `ScreenSpec` 하나 = Story 하나. `chip` 은 Story 짧은 이름, `scope` 는 번호 이름공간
   - 번호는 **Story 마다 1 부터**. 큰 영역 `1`, 그 안의 요소 `1-1`
   - 화면 요소에 `data-anno="<scope>:<n>"` 을 단다. 조건부 요소는 `when` 을 적는다
   - `display` 는 형태가 아니라 **알려주는 것**, `policy` 는 **코드로 옮길 수 있는 규칙**만 (prd-guide §1.4-A·B)
   - 페이지에서 `<ScreenSpecRegistrar spec={SPEC} />` 로 등록한다
4. 주석 모드를 켜고 **번호 → 대상 요소 대조표**에서 대조 실패가 0 인지 확인한다
5. `frontend/` 에서 `pnpm --filter playground run build` 가 통과해야 커밋한다 — playground 는 `beta` 에서 바로 배포된다

## 2. 문서 갱신 (PR 올리기 전)

프로토타입이 **정본**이다. 문서는 프로토타입과 `spec.ts` 를 근거로 쓰고, 프로토에 없는 것은 창작하지 않는다.

### PRD.md — `01-planning/stories/{story-name}/PRD.md`

- prototype-agent `references/prd-guide.md` 의 Story PRD 구성을 따른다
  - 제목 = 정규문장 · `기준 프로토타입:` 한 줄
  - §1 기본설명 (흐름 다이어그램 · 완료 기준) · §2 화면명세 (`spec.ts` 번호와 1:1) · §3 시스템 요건 · §4 미확정
- `spec.ts` 의 번호·`display`·`behavior`·`policy`·`data` 를 §2 의 내용·동작·정책·데이터로 옮긴다. 번호를 바꾸지 않는다
- 프로토 링크는 배포된 절대 URL 만. 배포 전이면 지면 이름만 적는다
- prd-guide §5 자가 검증 체크리스트를 통과시킨다

### SPEC.md — API 계약

- 이 레포의 API 계약은 `specs/{도메인}/spec.md` 다. Story 폴더에 따로 만들지 않는다
- 프로토의 `TODO(api)` 와 PRD §3 의 API 가 스펙의 엔드포인트 목록에 있는지 확인한다. 없으면 [`/spec`](./spec.md) 규약으로 추가한다
- 스펙 헤더의 `Story PRD:` 에 PRD 링크를 건다

### 인덱스

- [`01-planning/_registry/stories.md`](../../01-planning/_registry/stories.md) 유저스토리 표의 PRD 칸에 링크를 건다
- 새 도메인 스펙이면 [`specs/README.md`](../../specs/README.md) 표에도 한 줄 추가한다

## 3. PR

- 대상 브랜치는 `beta`
- 한 PR = 한 Story. 프로토타입과 문서를 같은 PR 에 담는다
- 본문에 Story 정규문장 · 프로토 지면 · PRD 링크 · 스펙 변경 여부 · 남은 미확정을 적는다
