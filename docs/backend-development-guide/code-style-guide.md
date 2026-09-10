# Code Style Guide

이름·주석처럼 **어떻게 쓸지**의 규약. 설계 원칙(무엇을 어디에 둘지)은 [`oop-guide.md`](oop-guide.md) 를 본다.

## Table of Contents

- [네이밍 규약](#네이밍-규약)
  - [Enum 클래스](#enum-클래스)
  - [의존성 필드](#의존성-필드)
- [주석](#주석)

## 네이밍 규약

### Enum 클래스

- **Enum 클래스 이름에 `Enum` 접미사를 붙이지 않는다.**
  - ❌ `StudyCohortStatusEnum`, `StudyStatusEnum`
  - ✅ `StudyCohortStatus`, `StudyStatus`
- 타입 자체가 이미 열거형임을 나타내므로 `Enum` 을 이름에 포함하는 것은 중복이다.

### 의존성 필드

- **주입받는 의존성 필드는 타입명을 lowerCamelCase 로 그대로 쓴다.**
  - ❌ `private final AccountRepository accounts;` — 도메인 복수형은 실제 목록에 써야 한다
  - ❌ `private final GoogleOAuthClient google;` · `private final StudyCohortRepository cohortRepository;`
  - ✅ `private final AccountRepository accountRepository;` · `private final GoogleOAuthClient googleOAuthClient;`
- 길어지지만 **무엇을 주입받았는지가 이름에 그대로 남는다.** 축약하면 같은 타입을 파일마다 다른
  이름으로 부르게 되고(`cohortRepository` vs `studyCohortRepository`), grep 이 안 걸린다.
- `accounts` 같은 복수형은 **실제 도메인 객체 목록**을 위해 비워 둔다:
  `List<Account> accounts = accountRepository.findAll();`
- 값·상태 필드에는 적용하지 않는다 — 의미 있는 이름을 쓴다 (`SecretKey key`, `String defaultMessage`).

## 주석

- **코드가 말하는 것을 주석으로 반복하지 않는다.**
  - ❌ `/** 페이지네이션 목록 응답 — endpoint-convention.md: { items, total, offset, limit }. */`
  - ❌ `// 1. 리포지토리에서 공개 스터디 조회` — 바로 아래 코드가 그 내용이다
  - ✅ 주석은 **왜(why)** 를 적을 때만: 비자명한 결정, 의도적 단순화, 알려진 제약
- Javadoc 은 **공개 API 의 계약**에만 쓴다 (다른 모듈이 호출하는 메서드). 내부 구현 메서드에 달지 않는다
- `// TODO(api)` 처럼 행동을 요구하는 마커는 허용한다
