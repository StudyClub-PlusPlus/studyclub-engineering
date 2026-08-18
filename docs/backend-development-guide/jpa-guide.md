# JPA Guide

## Table of Contents

- [N+1 문제](#n1-문제)
- [Lazy Loading 주의점](#lazy-loading-주의점)
- [트랜잭션 범위](#트랜잭션-범위)
- [엔티티 설계 규칙](#엔티티-설계-규칙)

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
@Table(name = "studies")
public class Study {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String title;

    @Enumerated(EnumType.STRING)  // ORDINAL 금지 (순서 변경 시 깨짐)
    private StudyStatus status;

    @OneToMany(mappedBy = "study", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StudyMember> members = new ArrayList<>();

    // setter 금지 — 의미 있는 메서드로 상태 변경
    // getters 는 필요한 것만
    protected Study() {}  // JPA 용 기본 생성자 (protected)
}
```

- `@Enumerated(EnumType.STRING)` 필수 — ORDINAL 은 enum 순서 바뀌면 데이터 꼬임
- `setter` 금지 → OOP Guide 참고
- 양방향 연관은 꼭 필요할 때만. 단방향으로 충분하면 단방향.
