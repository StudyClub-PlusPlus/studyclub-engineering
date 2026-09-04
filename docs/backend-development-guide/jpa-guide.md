# JPA Guide

## Table of Contents

- [BaseEntity — 모든 엔티티의 부모](#baseentity--모든-엔티티의-부모)
- [N+1 문제](#n1-문제)
- [Lazy Loading 주의점](#lazy-loading-주의점)
- [트랜잭션 범위](#트랜잭션-범위)
- [엔티티 설계 규칙](#엔티티-설계-규칙)

## BaseEntity — 모든 엔티티의 부모

**새 엔티티는 예외 없이 `BaseEntity` 를 상속한다.**

```java
@Entity
@Table(name = "STUDIES")
public class Study extends BaseEntity {   // createdAt / updatedAt 이 자동으로 따라온다
    ...
}
```

```java
// domain/src/main/java/com/studyclub/domain/support/BaseEntity.java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
```

값을 채우는 것은 `@EnableJpaAuditing`(`api/.../config/JpaConfig.java`)이 켜는 리스너다.

- **감사 컬럼을 손으로 채우지 않는다.** `this.createdAt = Instant.now()` 를 엔티티에 박으면
  엔티티마다 같은 코드가 복사되고, 한 군데만 빠뜨려도 "언제 만들어졌는지 모르는 행"이 생긴다.
- **시각은 `Instant`(UTC).** `LocalDateTime` 을 쓰면 서버 타임존이 바뀔 때 과거 데이터의 의미가
  조용히 달라진다 — 스터디원이 3개 타임존에 흩어져 있어 특히 위험하다. 타임존 변환은 화면의 일이다.
- 마이그레이션 SQL 에도 `created_at DATETIME(6) NOT NULL`, `updated_at DATETIME(6) NOT NULL` 을 같이 넣는다.

> ⚠️ `@EnableJpaAuditing` 한 줄을 지우면 **컴파일도 되고 엔티티 단위 테스트도 통과하는데
> DB 에는 null 이 들어간다.** 그래서 `UserAuditingTest` 가 persist 까지 해서 값이 채워지는지 본다.

## N+1 문제

### 문제

```java
// Study 1건 조회 → members 접근 시 추가 쿼리 N건
List<Study> studies = studyRepository.findAll();       // 쿼리 1회
for (Study s : studies) {
    s.getMembers().size();  // 스터디마다 쿼리 1회 → 총 N+1
}
```

### 해결

**1. Fetch Join (JPQL)**

```java
@Query("SELECT s FROM Study s JOIN FETCH s.members WHERE s.status = :status")
List<Study> findByStatusWithMembers(@Param("status") StudyStatus status);
```

**2. @EntityGraph**

```java
@EntityGraph(attributePaths = {"members"})
List<Study> findByStatus(StudyStatus status);
```

**3. Batch Size (글로벌)**

```yaml
# application.yml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 100
```

선택 기준:
- 항상 함께 쓰는 연관 → Fetch Join
- 조건부로 쓰는 연관 → Batch Size

## Lazy Loading 주의점

### 기본 전략

```java
@OneToMany → LAZY (기본)
@ManyToOne → EAGER (기본) → LAZY 로 변경 권장
```

```java
// ✅ 모든 연관 관계를 LAZY 로
@ManyToOne(fetch = FetchType.LAZY)
private Study study;
```

### LazyInitializationException

트랜잭션 밖에서 Lazy 프록시 접근 시 발생:

```java
// ❌ 서비스에서 엔티티 반환 → 컨트롤러에서 Lazy 접근
@GetMapping("/studies/{id}")
public Study getStudy(@PathVariable Long id) {
    Study study = studyService.findById(id);
    study.getMembers().size();  // 💥 LazyInitializationException
}
```

해결:
- **DTO 변환은 서비스(트랜잭션) 안에서** 수행
- 또는 Fetch Join 으로 필요한 연관을 미리 로드

```java
// ✅ 서비스에서 DTO 변환
@Transactional(readOnly = true)
public StudyDetailResponse findById(Long id) {
    Study study = studyRepository.findByIdWithMembers(id)
        .orElseThrow(() -> new NotFoundException("스터디를 찾을 수 없습니다"));
    return StudyDetailResponse.from(study);  // 트랜잭션 안에서 변환
}
```

## 트랜잭션 범위

```java
// 조회 전용 → readOnly (성능 최적화)
@Transactional(readOnly = true)
public StudyResponse findById(Long id) { ... }

// 변경 → 기본 트랜잭션
@Transactional
public void closeStudy(Long id, Long userId) { ... }
```

### 규칙

1. `@Transactional` 은 **서비스 레이어**에 건다 (컨트롤러 X, Repository X)
2. 조회만 하면 `readOnly = true`
3. 트랜잭션 범위를 최소화 — 외부 API 호출은 트랜잭션 밖에서

```java
// ❌ 외부 호출이 트랜잭션 안에 있으면 커넥션을 오래 물고 있음
@Transactional
public void createAndNotify(CreateStudyRequest req) {
    Study study = studyRepository.save(...);
    slackClient.notify(study);  // 느린 외부 호출
}

// ✅ 분리
@Transactional
public Study create(CreateStudyRequest req) {
    return studyRepository.save(...);
}

public void createAndNotify(CreateStudyRequest req) {
    Study study = create(req);      // 트랜잭션 종료
    slackClient.notify(study);      // 트랜잭션 밖
}
```

## 엔티티 설계 규칙

```java
@Entity
@Table(name = "STUDIES")          // 테이블 이름은 대문자 (database-guide.md)
public class Study extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Enumerated(EnumType.STRING)  // ORDINAL 금지 (순서 변경 시 깨짐)
    @Column(nullable = false, length = 20)
    private StudyStatus status;

    // 같은 애그리거트 안 → 연관으로 묶는다
    @OneToMany(mappedBy = "study", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StudyMember> members = new ArrayList<>();

    // 다른 애그리거트(User) → 객체가 아니라 ID 로 참조한다
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    // setter 금지 — 의미 있는 메서드로 상태 변경
    // getters 는 필요한 것만
    protected Study() {}  // JPA 용 기본 생성자 (protected)
}
```

- **`BaseEntity` 상속 필수** — 감사 컬럼을 손으로 만들지 않는다
- **테이블 이름은 대문자**, 컬럼은 소문자 snake_case → [`database-guide.md`](database-guide.md#테이블컬럼-이름-규칙)
- `@Enumerated(EnumType.STRING)` 필수 — ORDINAL 은 enum 순서 바뀌면 데이터 꼬임
- `setter` 금지 → [`oop-guide.md`](oop-guide.md)
- **애그리거트 사이는 ID 참조.** 객체로 물면 트랜잭션 경계가 흐려지고 cascade 가 번진다
  → [`ddd-guide.md`](ddd-guide.md#애그리거트--경계가-트랜잭션이다)
- 양방향 연관은 꼭 필요할 때만. 단방향으로 충분하면 단방향
- **DB 외래키를 걸지 말지는 애그리거트 경계로 판정한다** → [`database-guide.md`](database-guide.md#외래키-정책)
- **스키마는 엔티티가 아니라 마이그레이션이 만든다.** 엔티티를 바꿨으면 같은 PR 에 `V{n}__*.sql` 을
  넣는다 — 안 넣으면 `ddl-auto: validate` 가 배포 시점에 부팅을 막는다
