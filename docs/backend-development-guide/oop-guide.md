# OOP & Encapsulation Guide

## Table of Contents

- [원칙](#원칙)
- [메서드는 내부 구현을 숨긴다](#메서드는-내부-구현을-숨긴다)
- [도메인 엔티티에 행위를 둔다](#도메인-엔티티에-행위를-둔다)
- [DTO ↔ Entity 변환](#dto--entity-변환)
- [서비스 레이어 책임](#서비스-레이어-책임)

## 원칙

- **Tell, Don't Ask** — 객체에게 데이터를 꺼내서 외부에서 판단하지 말고, 객체에게 행위를 시킨다
- **캡슐화** — 내부 상태 변경은 객체 자신의 메서드를 통해서만
- **호출자는 구현을 모른다** — 메서드 시그니처만 보고 무엇을 하는지 알 수 있어야 한다

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

### 주석

- **코드가 말하는 것을 주석으로 반복하지 않는다.**
  - ❌ `/** 페이지네이션 목록 응답 — endpoint-convention.md: { items, total, offset, limit }. */`
  - ❌ `// 1. 리포지토리에서 공개 스터디 조회` — 바로 아래 코드가 그 내용이다
  - ✅ 주석은 **왜(why)** 를 적을 때만: 비자명한 결정, 의도적 단순화, 알려진 제약
- Javadoc 은 **공개 API 의 계약**에만 쓴다 (다른 모듈이 호출하는 메서드). 내부 구현 메서드에 달지 않는다
- `// TODO(api)` 처럼 행동을 요구하는 마커는 허용한다

## 메서드는 내부 구현을 숨긴다

```java
// ❌ 호출자가 내부 구현을 알아야 한다
study.setStatus("CLOSED");
study.setClosedAt(LocalDateTime.now());
study.setClosedBy(userId);

// ✅ 의도를 드러내는 메서드 하나
study.close(userId);
```

```java
// Study.java (도메인 엔티티)
public void close(Long userId) {
    if (this.status == StudyStatus.CLOSED) {
        throw new IllegalStateException("이미 마감된 스터디입니다");
    }
    this.status = StudyStatus.CLOSED;
    this.closedAt = LocalDateTime.now();
    this.closedBy = userId;
}
```

핵심: **호출자는 `close()` 가 내부에서 뭘 바꾸는지 몰라도 된다.** 상태 전이 규칙과 부수효과는 엔티티가 책임진다.

## 도메인 엔티티에 행위를 둔다

```java
// ❌ 서비스에서 로직 처리 (절차적)
public void joinStudy(Long studyId, Long userId) {
    Study study = studyRepository.findById(studyId).orElseThrow();
    if (study.getMembers().size() >= study.getMaxMembers()) {
        throw new IllegalStateException("정원 초과");
    }
    if (study.getStatus() != StudyStatus.RECRUITING) {
        throw new IllegalStateException("모집 중이 아닙니다");
    }
    study.getMembers().add(new StudyMember(study, userId));
}

// ✅ 엔티티가 비즈니스 규칙을 갖는다
public void joinStudy(Long studyId, Long userId) {
    Study study = studyRepository.findById(studyId).orElseThrow();
    study.addMember(userId);  // 검증 + 추가를 엔티티가 책임
}
```

```java
// Study.java
public void addMember(Long userId) {
    validateRecruiting();
    validateCapacity();
    this.members.add(new StudyMember(this, userId));
}

private void validateRecruiting() {
    if (this.status != StudyStatus.RECRUITING) {
        throw new IllegalStateException("모집 중이 아닙니다");
    }
}

private void validateCapacity() {
    if (this.members.size() >= this.maxMembers) {
        throw new IllegalStateException("정원 초과");
    }
}
```

## DTO ↔ Entity 변환

- **Entity → DTO**: DTO 의 정적 팩토리 메서드 (`from`, `of`)
- **DTO → Entity**: Entity 의 정적 팩토리 또는 생성자
- Entity 를 컨트롤러 응답으로 직접 반환하지 않는다

```java
// DTO 에 변환 책임
public record StudyResponse(Long id, String title, String status) {
    public static StudyResponse from(Study study) {
        return new StudyResponse(study.getId(), study.getTitle(), study.getStatus().name());
    }
}

// 컨트롤러
@GetMapping("/studies/{id}")
public StudyResponse getStudy(@PathVariable Long id) {
    return studyService.findById(id);   // 서비스가 트랜잭션 안에서 DTO 로 변환해 돌려준다
}
```

## 서비스 레이어 책임

서비스는 **오케스트레이션**만 한다:

1. Repository 에서 엔티티 조회
2. 엔티티의 비즈니스 메서드 호출
3. 필요 시 이벤트 발행 / 외부 서비스 호출
4. 트랜잭션 관리

```java
// ✅ 서비스는 흐름만 조율
@Transactional
public void closeStudy(Long studyId, Long userId) {
    Study study = studyRepository.findById(studyId)
        .orElseThrow(() -> new NotFoundException("스터디를 찾을 수 없습니다"));
    study.close(userId);          // 비즈니스 로직은 엔티티
    // JPA dirty checking → 자동 update
}
```

서비스에 `if/else` 가 많아지면 → 도메인 로직이 새고 있다는 신호.
