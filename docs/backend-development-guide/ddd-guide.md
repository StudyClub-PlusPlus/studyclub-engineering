# DDD Guide

> 코드를 쓰기 전에 읽는다. 새 기능은 [새 기능 추가 절차](#새-기능-추가-절차)의 순서를 따른다.

## Table of Contents

- [이 프로젝트가 하는 DDD / 안 하는 DDD](#이-프로젝트가-하는-ddd--안-하는-ddd)
- [용어](#용어)
- [레이어와 모듈 매핑](#레이어와-모듈-매핑)
- [애그리거트 — 경계가 트랜잭션이다](#애그리거트--경계가-트랜잭션이다)
- [엔티티에 행위를 둔다](#엔티티에-행위를-둔다)
- [값 객체](#값-객체)
- [도메인 서비스 — 마지막 수단](#도메인-서비스--마지막-수단)
- [애플리케이션 서비스는 조립만 한다](#애플리케이션-서비스는-조립만-한다)
- [도메인 예외](#도메인-예외)
- [새 기능 추가 절차](#새-기능-추가-절차)
- [안티패턴](#안티패턴)
- [현재 알려진 부채](#현재-알려진-부채)

## 이 프로젝트가 하는 DDD / 안 하는 DDD

DDD 를 전부 하지 않는다. **전술적 DDD**(애그리거트·엔티티·값 객체·리포지토리)만 하고,
전략적 DDD(바운디드 컨텍스트 분리, 컨텍스트 맵, 이벤트 스토밍)는 하지 않는다.

| 한다 | 안 한다 | 왜 |
|------|---------|-----|
| 애그리거트 · 엔티티 · 값 객체 | 바운디드 컨텍스트별 모듈/서비스 분리 | 서비스 하나에 팀 하나다. 지금 쪼개면 관리 비용만 는다 |
| 도메인 로직을 엔티티에 | 도메인 이벤트 · 이벤트 소싱 | 비동기 흐름이 아직 없다. 필요해지면 그때 |
| 리포지토리 인터페이스 | CQRS · 읽기 모델 분리 | 읽기 부하가 문제가 된 적이 없다 |

> **판정 한 문장** — "이 개념을 지우면 도메인 규칙을 어디에 둘지 모르게 되는가?" 그렇다면 쓴다.
> 아니면 아직 이르다.

## 용어

| 용어 | 뜻 | 이 프로젝트의 예 |
|------|-----|------------------|
| **도메인** | 서비스가 다루는 문제 영역 | 스터디 모집·참여·출석 |
| **엔티티** | 식별자(id)로 구분되고 상태가 변하는 것 | `User`, `Study` |
| **값 객체(VO)** | 식별자가 없고 값이 같으면 같은 것. 불변 | `Email`, `Period`, `Capacity` |
| **애그리거트** | 함께 변경되어야 하는 엔티티 묶음. 밖에서는 **루트만** 만진다 | `Study`(루트) + `StudyMember` |
| **리포지토리** | 애그리거트 루트 단위의 저장/조회. 애그리거트당 하나 | `StudyRepository` |
| **도메인 서비스** | 엔티티 하나에 넣기 어색한 도메인 규칙 (여러 애그리거트를 걸침) | 중복 신청 검사 |
| **애플리케이션 서비스** | 유스케이스 조립 — 트랜잭션·조회·DTO 변환 | `AuthService` |

## 레이어와 모듈 매핑

```
api     ← 표현(컨트롤러·DTO·시큐리티) + 응용(애플리케이션 서비스)
domain  ← 도메인(엔티티·값 객체·도메인 서비스·리포지토리 인터페이스)
common  ← 어디에도 의존하지 않는 순수 타입 (ErrorCode·ErrorResponse·BusinessException)
```

의존 방향은 **한쪽으로만** 흐른다: `api → domain → common`.

- **domain 은 웹을 모른다.** `HttpStatus`·`ResponseEntity`·`@RequestBody`·`ResponseStatusException`
  을 domain 에서 import 하면 잘못된 것이다. 도메인 규칙이 HTTP 와 묶이면 배치·이벤트 같은
  다른 진입점에서 재사용할 수 없다.
- domain 이 갖는 스프링 의존은 **JPA/Auditing 까지**다 (`spring-boot-starter-data-jpa`).
  MVC·Security 는 들이지 않는다.
- **common 은 아무것도 모른다.** 그래서 `ErrorCode` 는 `HttpStatus` 가 아니라 `int status` 를 든다.

## 애그리거트 — 경계가 트랜잭션이다

애그리거트를 정하는 것은 곧 **한 트랜잭션에서 함께 바뀌는 범위**를 정하는 것이다.

```
Study (애그리거트 루트)
 └── StudyMember   ← Study 를 통해서만 추가/제거된다
```

규칙:

1. **밖에서는 루트만 참조한다.** `StudyMemberRepository` 를 만들어 멤버를 직접 조작하지 않는다.
   `study.addMember(userId)` 로 루트를 거친다 — 정원·상태 검사가 루트에 있기 때문이다.
2. **애그리거트 하나 = 트랜잭션 하나.** 한 트랜잭션에서 여러 애그리거트를 동시에 바꾸지 않는다.
   꼭 필요하면 유스케이스를 나누고, 실패 시 무엇이 남는지 명시한다.
3. **애그리거트 사이는 객체 참조가 아니라 ID 로 잇는다.**

```java
// ❌ 다른 애그리거트를 객체로 물면 경계가 사라진다 (Lazy 지옥 + 의도치 않은 cascade)
@ManyToOne
private User owner;

// ✅ ID 로 참조 — Study 와 User 는 각자의 트랜잭션을 갖는다
@Column(name = "owner_id", nullable = false)
private Long ownerId;
```

> 외래키(FK)를 실제로 걸지 말지는 이 경계와 붙어 있다 →
> [`database-guide.md` 의 외래키 정책](database-guide.md#외래키-정책)

## 엔티티에 행위를 둔다

**엔티티가 자기 규칙을 안다.** 상태를 꺼내 밖에서 판단하지 않는다.

```java
// ❌ 규칙이 서비스에 흩어진다 — 다른 유스케이스에서 이 검사를 빠뜨리면 그대로 뚫린다
if (study.getStatus() == RECRUITING && study.getMembers().size() < study.getMaxMembers()) {
    study.getMembers().add(new StudyMember(userId));
}

// ✅ 규칙이 한 곳에 있고, 호출자는 내부를 모른다
study.addMember(userId);
```

```java
// Study.java — domain 모듈
public void addMember(Long userId) {
    if (status != StudyStatus.RECRUITING) {
        throw new BusinessException(ErrorCode.CONFLICT, "모집 중인 스터디가 아닙니다.");
    }
    if (members.size() >= capacity.max()) {
        throw new BusinessException(ErrorCode.CONFLICT, "정원이 찼습니다.");
    }
    if (members.stream().anyMatch(m -> m.isUser(userId))) {
        throw new BusinessException(ErrorCode.CONFLICT, "이미 신청한 스터디입니다.");
    }
    members.add(new StudyMember(this, userId));
}
```

- **setter 를 만들지 않는다.** 의미 있는 이름의 메서드로만 상태를 바꾼다 (`close()`, `addMember()`).
- **생성자에서 불변식을 지킨다.** 만들어질 때 이미 유효해야 한다. "나중에 채우는" 필드를 두지 않는다.
- 자세한 내용은 [`oop-guide.md`](oop-guide.md).

## 값 객체

식별자가 필요 없고 **값이 같으면 같은 것**이면 값 객체다. `record` + `@Embeddable`.

```java
@Embeddable
public record Capacity(int min, int max) {

    public Capacity {
        // 검증을 값 객체 안에 두면, 이 타입을 쓰는 모든 곳이 자동으로 안전해진다
        if (min < 2) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "최소 인원은 2명 이상입니다.");
        }
        if (max < min) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "최대 인원이 최소 인원보다 적습니다.");
        }
    }

    public boolean isFull(int current) {
        return current >= max;
    }
}
```

값 객체로 만들 신호:
- 원시 타입 두세 개가 **항상 같이 다닌다** (`startAt`/`endAt` → `Period`)
- 그 값에 **검증 규칙**이 있다 (`email`, `capacity`)
- 그 값에 대해 묻고 싶은 **질문**이 있다 (`period.contains(now)`, `capacity.isFull(n)`)

원시 타입을 그냥 쓰면 그 검증과 질문이 호출부마다 복사된다.

## 도메인 서비스 — 마지막 수단

**엔티티에 넣을 자리가 정말 없을 때만 만든다.** 도메인 규칙의 기본 집은 엔티티이고,
도메인 서비스는 예외다. 이 순서를 뒤집으면 이름만 도메인일 뿐 [빈약한 도메인 모델](#안티패턴)이 된다.

### 판정 — 세 개를 다 통과해야 만든다

1. **어느 엔티티의 규칙도 아니다.** "이 판단의 주인이 누구냐"에 답이 안 나온다
   (여러 애그리거트를 동시에 봐야 하거나, 어느 쪽에 넣어도 그 엔티티가 남의 일을 하게 된다)
2. **도메인 언어로 이름이 붙는다.** `StudyEnrollment`, `WaitlistPromotion` — 회의에서 쓰는 말이다.
   `StudyHelper`·`StudyManager`·`StudyUtil` 이 나오면 그건 도메인 서비스가 아니다
3. **상태를 갖지 않는다.** 필드는 리포지토리·다른 도메인 서비스뿐. 요청 데이터를 담아 두지 않는다

### 예시 — 신청 승인 (두 애그리거트를 걸친다)

신청서는 `STUDY_APPLICATION` 애그리거트, 명부는 `STUDY_PARTICIPANT` 애그리거트다.
"승인하면 명부에 편입된다"는 **어느 한쪽의 규칙이 아니다** — 양쪽을 다 알아야 판단이 선다.

```java
// domain/.../study/StudyEnrollment.java — 스프링 어노테이션 없는 순수 클래스
public class StudyEnrollment {

    private final StudyParticipantRepository participants;

    public StudyEnrollment(StudyParticipantRepository participants) {
        this.participants = participants;
    }

    /** 승인 = 신청서 상태 전이 + 명부 편입. 둘 중 하나만 일어나면 안 된다. */
    public StudyParticipant approve(StudyApplication application, StudySection section) {
        if (participants.existsBySectionAndUser(section.getId(), application.getUserId())) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 명부에 있는 사람입니다.");
        }
        if (section.isFull(participants.countActive(section.getId()))) {
            throw new BusinessException(ErrorCode.CONFLICT, "반 정원이 찼습니다.");
        }
        application.approve();                       // 상태 전이는 여전히 엔티티가 한다
        return participants.save(StudyParticipant.of(section.getId(), application.getUserId()));
    }
}
```

**엔티티가 할 일을 뺏지 않았다** — `application.approve()` 는 그대로 신청서가 한다.
도메인 서비스는 **두 애그리거트를 잇는 규칙**(중복·정원)만 갖는다.

> ⚠️ 이 예시는 [애그리거트 규칙 2번](#애그리거트--경계가-트랜잭션이다)("한 트랜잭션 = 한 애그리거트")과
> 부딪친다. 신청 승인은 **부분 성공이 곧 데이터 깨짐**이라 예외로 한 트랜잭션에 묶는다.
> 이런 예외를 만들 때는 **왜 나눌 수 없는지**를 코드 주석에 남긴다. 남기지 않으면 다음 사람이
> "규칙이 안 지켜지네" 하고 아무 데서나 따라 한다.

### 도메인 서비스 vs 애플리케이션 서비스

이름이 비슷해서 제일 많이 섞인다.

| | 도메인 서비스 | 애플리케이션 서비스 |
|---|---|---|
| 모듈 | `domain` | `api` |
| 아는 것 | 도메인 규칙 | 유스케이스 흐름 |
| 모르는 것 | 트랜잭션·DTO·HTTP·인증 | 도메인 규칙의 세부 |
| `@Transactional` | **안 붙인다** | 붙인다 |
| DTO 변환 | 안 한다 | 한다 |
| 답하는 질문 | "이 편입이 유효한가" | "이 요청을 어떤 순서로 처리하나" |

```java
// 애플리케이션 서비스 — 조립만
@Transactional
public StudyParticipantResponse approve(Long applicationId, Long sectionId) {
    StudyApplication application = applications.findById(applicationId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "신청서를 찾을 수 없습니다."));
    StudySection section = sections.findById(sectionId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "반을 찾을 수 없습니다."));

    StudyParticipant participant = enrollment.approve(application, section);   // ← 규칙은 전부 저 안

    return StudyParticipantResponse.from(participant);
}
```

### 만들지 말아야 할 때

| 상황 | 왜 아닌가 | 대신 |
|---|---|---|
| 엔티티 하나만 보면 되는 검증 | 그 엔티티의 규칙이다 | 엔티티 메서드 |
| 값에 대한 검증·계산 | 그 값의 규칙이다 | [값 객체](#값-객체) |
| 외부 API 호출·메일 발송 | 도메인이 아니라 인프라다 | 애플리케이션 서비스에서 트랜잭션 밖으로 |
| 조회 전용 로직 | 규칙이 아니라 질의다 | 리포지토리 쿼리 + DTO 변환 |
| "서비스가 길어져서" | 길이는 이유가 아니다 | 규칙을 엔티티로 되돌린다 |

> **현재 이 프로젝트에 도메인 서비스는 하나도 없다.** 애그리거트가 아직 `User` 하나뿐이라
> 걸칠 대상이 없다. 위 예시는 목표 모양이다 — 첫 번째를 만들 때 이 절의 판정 3개를 먼저 통과시킨다.

## 애플리케이션 서비스는 조립만 한다

애플리케이션 서비스(`@Service`)가 하는 일은 **네 가지뿐**이다.

1. 트랜잭션 경계 긋기 (`@Transactional`)
2. 리포지토리로 애그리거트 불러오기
3. **애그리거트에게 시키기** (여기에 if 문이 쌓이면 도메인 로직이 샌 것)
4. DTO 로 변환해 돌려주기 (트랜잭션 안에서 — [`jpa-guide.md`](jpa-guide.md) Lazy 참고)

```java
@Transactional
public StudyResponse join(Long studyId, Long userId) {
    Study study = studies.findById(studyId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));

    study.addMember(userId);   // ← 규칙은 전부 여기 안에 있다

    return StudyResponse.from(study);
}
```

**서비스 메서드에 `if` 가 세 개 넘게 쌓이면 멈추고 묻는다** — 이 판단은 엔티티가 해야 하는 것 아닌가.

## 도메인 예외

도메인은 HTTP 를 모르지만 **무엇이 잘못됐는지**는 안다. 그래서 `BusinessException` + `ErrorCode` 를 쓴다.
상태 코드 매핑은 `ErrorCode` 가 한 번만 갖고 있고, 응답 변환은 `GlobalExceptionHandler` 가 한다.

```java
// ✅ 도메인/서비스 — 웹을 모른다
throw new BusinessException(ErrorCode.CONFLICT, "이미 마감된 스터디입니다.");

// ❌ 도메인에서 웹 타입을 쓰면 레이어가 뒤집힌다
throw new ResponseStatusException(HttpStatus.CONFLICT, "...");
```

상세는 [`exception-handling-guide.md`](exception-handling-guide.md).

## 새 기능 추가 절차

1. **기존 API 로 되는지 먼저 본다** — [`../common-guide.md`](../common-guide.md)
2. **애그리거트를 정한다.** 무엇과 무엇이 한 트랜잭션에서 같이 바뀌는가. 루트는 누구인가
3. **domain 에 엔티티/값 객체와 규칙을 쓴다.** 웹 타입 import 금지. `BaseEntity` 상속
   · 여러 애그리거트를 걸치는 규칙만 [도메인 서비스](#도메인-서비스--마지막-수단)로 (판정 3개 통과 시)
4. **단위 테스트로 규칙을 먼저 못 박는다** — 실패 케이스부터 ([`testing-guide.md`](testing-guide.md))
5. **리포지토리 인터페이스**를 애그리거트 루트 단위로 추가
6. **마이그레이션 SQL**(`V{n}__*.sql`)을 쓴다 — [`database-guide.md`](database-guide.md)
7. **애플리케이션 서비스**로 유스케이스를 조립 (트랜잭션·DTO 변환)
8. **컨트롤러 + DTO** — [`api/endpoint-convention.md`](api/endpoint-convention.md), [`validation-guide.md`](validation-guide.md)
9. **통합 테스트**로 성공 1건 + 실패 코어를 덮는다

## 안티패턴

| 안티패턴 | 증상 | 고치는 법 |
|---|---|---|
| **빈약한 도메인 모델** | 엔티티가 getter/setter 뿐이고 서비스에 if 가 쌓인다 | 판단을 엔티티 메서드로 옮긴다 |
| **트랜잭션 스크립트** | 서비스 메서드 하나가 100줄 | 유스케이스를 나누고 규칙을 엔티티로 |
| **애그리거트 경계 무시** | 다른 애그리거트를 `@ManyToOne` 으로 물고 cascade | ID 참조로 바꾼다 |
| **도메인이 웹을 안다** | domain 에서 `HttpStatus` import | `ErrorCode` 로 바꾼다 |
| **DTO 가 엔티티를 노출** | 컨트롤러가 엔티티를 그대로 반환 | 서비스에서 DTO 변환 (PII 도 여기서 거른다) |
| **리포지토리 남발** | 애그리거트 내부 엔티티마다 리포지토리 | 루트 리포지토리 하나 |
| **도메인 서비스 남용** | `XxxManager`·`XxxHelper` 가 늘고 엔티티는 getter 뿐 | [판정 3개](#판정--세-개를-다-통과해야-만든다)를 다시 통과시킨다 |

## 현재 알려진 부채

정직하게 적어 둔다 — 문서가 코드보다 앞서 있으면 문서를 안 믿게 된다.

- `User` 엔티티가 `api` 모듈(`com.studyclub.api.auth`)에 있다. `domain` 으로 옮겨야 한다
  (별도 이슈). 새로 만드는 엔티티는 **`domain` 모듈에** 만든다.
- `Study` 는 아직 `record` 스캐폴드이고 컨트롤러가 하드코딩 픽스처를 준다. 실제 애그리거트로
  바꿀 때 이 문서의 예시(`addMember`, `Capacity`)를 기준으로 삼는다.
- 값 객체가 아직 코드에 하나도 없다. 위 예시는 목표 모양이다.
