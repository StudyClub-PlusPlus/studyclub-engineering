# Testing Guide

## Table of Contents

- [기능마다 자동으로 쓰는 테스트](#기능마다-자동으로-쓰는-테스트)
- [테스트 계층](#테스트-계층)
- [네이밍 규칙 — 한글로 쓴다](#네이밍-규칙--한글로-쓴다)
- [단위 테스트 — 세세하게](#단위-테스트--세세하게)
- [통합 테스트 — 성공 1건 + 실패 코어](#통합-테스트--성공-1건--실패-코어)
- [슬라이스 테스트](#슬라이스-테스트)
- [테스트 환경](#테스트-환경)
- [테스트 작성 원칙](#테스트-작성-원칙)
- [실행](#실행)

## 기능마다 자동으로 쓰는 테스트

**시키지 않아도 쓴다.** 기능을 추가·수정하는 PR 에는 아래 두 종류가 같이 들어온다.

| 종류 | 무엇을 | 얼마나 |
|------|--------|--------|
| **통합 테스트** | 그 API 의 **성공 1건 + 실패 코어** | 코어만. 조합을 다 덮지 않는다 |
| **단위 테스트** | 도메인 규칙의 **세부·경계값** | 세세하게. 분기마다 |

"실패 코어"는 그 엔드포인트에서 **실제로 자주 일어나고, 잘못 처리되면 아픈** 실패다. 최소:

- 인증이 필요한데 **토큰이 없을 때** → 401 + `errorCode`
- 필수 입력이 **비었을 때** → 400 + `errorCode`
- 권한이 **없는 사용자**일 때 → 403 (권한 가드가 있는 엔드포인트)
- 대상이 **없을 때** → 404

통합에서 조합 폭발을 쫓지 않는다. 정원 초과·중복 신청·상태 전이 같은 **규칙의 세부는 단위 테스트**가
훨씬 싸게 덮는다. 통합은 "배선이 이어져 있고 실패가 계약대로 나온다"만 지킨다.

## 테스트 계층

| 계층 | 대상 | 도구 | 속도 |
|------|------|------|------|
| 단위 | 도메인 엔티티·값 객체·유틸 | JUnit 5 + AssertJ | 빠름 |
| 슬라이스 | 컨트롤러, Repository, 감사 | `@WebMvcTest`, `@DataJpaTest` | 중간 |
| 통합 | API 전체 흐름 | `@SpringBootTest` + `TestRestTemplate` | 느림 |

비율 목표: **단위 > 슬라이스 > 통합** (테스트 피라미드)

## 네이밍 규칙 — 한글로 쓴다

```
src/test/java/com/studyclub/{module}/...
```

- 클래스: `{대상}Test`(단위·슬라이스), `{대상}IntegrationTest`(통합)
- **`@DisplayName` 은 한글로 쓴다.** 테스트 목록이 곧 스펙 문서가 되어야 하고,
  이 팀의 스펙은 한글로 논의된다. 영어로 옮기면 뉘앙스가 사라진다.
- 메서드 이름은 영어 (도구·리포트 호환). 뜻은 `@DisplayName` 이 진다.
- **`@DisplayName` 에 "왜"를 한 조각 넣는다.** 무엇을 검증하는지만 쓰면 나중에 그 테스트를
  지워도 되는지 판단할 수 없다.

```java
@Test
@DisplayName("실패 - 토큰 없이 /auth/me → 401 + errorCode UNAUTHORIZED (시큐리티가 막아도 같은 모양)")
void unauthenticatedReturnsErrorResponse() { ... }

@Test
@DisplayName("사진 URL 이 컬럼(2048)을 넘으면 버린다 — 잘린 URL 은 깨진 이미지라 없느니만 못하다")
void dropsOverlongPicture() { ... }
```

## 단위 테스트 — 세세하게

도메인 규칙은 Spring 없이, 분기마다 검증한다. 빠르니까 아낄 이유가 없다.

```java
class StudyTest {

    @Test
    @DisplayName("모집 중이면 멤버를 추가할 수 있다")
    void addsMemberWhenRecruiting() {
        // given
        Study study = Study.recruiting("알고리즘", new Capacity(2, 5), 1L);

        // when
        study.addMember(10L);

        // then
        assertThat(study.memberCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("정원이 차면 신청을 막는다 — 초과 신청은 운영에서 되돌리기가 가장 비싸다")
    void rejectsWhenFull() {
        Study study = studyWithMembers(5);

        assertThatThrownBy(() -> study.addMember(99L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("정원");
    }

    @Test
    @DisplayName("같은 사람이 두 번 신청하면 막는다")
    void rejectsDuplicate() { ... }

    @Test
    @DisplayName("모집이 끝난 스터디에는 신청할 수 없다")
    void rejectsWhenClosed() { ... }
}
```

**경계값을 빠뜨리지 않는다** — 정원 0 / 1 / max-1 / max / max+1, 빈 문자열, null, 최대 길이.

## 통합 테스트 — 성공 1건 + 실패 코어

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    /** 레거시 HttpURLConnection 은 바디 있는 POST 에 401 이 오면 응답을 못 읽는다 (클라이언트 제약). */
    @BeforeEach
    void useModernHttpClient() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    @Test
    @DisplayName("성공 - 공개 엔드포인트는 payload 를 그대로 준다 (success 래퍼 없음)")
    void publicEndpointReturnsBarePayload() {
        var response = rest.getForEntity("/api/studies", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain("success");
    }

    @Test
    @DisplayName("실패 - 토큰 없이 /auth/me → 401 + errorCode UNAUTHORIZED")
    void unauthenticatedReturnsErrorResponse() {
        var response = rest.getForEntity("/auth/me", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }
}
```

통합 테스트가 지키는 것은 기능이 아니라 **계약**이다:

1. 성공 응답에 `success` 같은 래퍼 필드가 없다 (payload 직접)
2. 실패 응답은 어디서 나든 `{errorCode, errorMessage}` 한 모양이다 —
   컨트롤러가 던지든, **시큐리티 필터가 막든**

2번이 특히 잘 깨진다. 시큐리티 필터는 `@RestControllerAdvice` 앞에서 응답을 끝내기 때문에,
핸들러만 고치고 `AuthenticationEntryPoint` 를 잊으면 **인증 실패만 조용히 빈 바디**가 된다.

## 슬라이스 테스트

컨트롤러만 (`@WebMvcTest`):

```java
@WebMvcTest(StudyController.class)
class StudyControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    StudyService studyService;

    @Test
    @DisplayName("GET /studies - 스터디 목록 조회")
    void returnsStudies() throws Exception {
        given(studyService.findAll()).willReturn(List.of(/* ... */));

        mockMvc.perform(get("/studies").header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk());
    }
}
```

DB 계층만 (`@DataJpaTest`). **어노테이션이 켜 주는 동작**은 여기서 검증한다 —
persist 를 거치지 않으면 잡히지 않기 때문이다:

```java
@DataJpaTest
@Import(JpaConfig.class)          // @EnableJpaAuditing 을 같이 올려야 값이 채워진다
class UserAuditingTest {

    @Test
    @DisplayName("저장하면 createdAt·updatedAt 이 자동으로 채워진다 — 엔티티가 손으로 넣지 않는다")
    void fillsAuditColumnsOnInsert() { ... }
}
```

## 테스트 환경

테스트는 **MySQL 컨테이너 없이 돈다.** 인프라를 요구하는 테스트는 아무도 안 돌린다.

```yaml
# api/src/test/resources/application.yml
spring:
  datasource:
    url: jdbc:h2:mem:studyclub;MODE=MySQL;DB_CLOSE_DELAY=-1
  flyway:
    enabled: false
  jpa:
    hibernate:
      ddl-auto: create-drop
```

⚠️ **한계를 알고 쓴다**: Flyway 를 끄고 스키마를 엔티티에서 만들기 때문에,
이 테스트들은 **마이그레이션 SQL 이 맞는지 검증하지 않는다** (`V*.sql` 은 MySQL 전용 DDL).
마이그레이션까지 검증이 필요해지면 Testcontainers(MySQL) 로 올린다.

## 테스트 작성 원칙

1. **Given-When-Then** 구조를 지킨다
2. **테스트 당 검증 하나** — 하나의 행위, 하나의 기대 결과
3. **테스트 간 독립** — 순서에 의존하지 않는다, 공유 상태 없음
4. **경계값 테스트** — 정원 0, 1, max, max+1 등
5. **실패 케이스 우선** — 해피 패스보다 예외/에러 케이스를 먼저 작성
6. **테스트 이름으로 스펙 문서** — `@DisplayName` 만 읽어도 요구사항이 보여야 한다
7. **사고가 나면 그 사고를 고정하는 테스트를 남긴다** — 무엇이 왜 터졌는지 주석에 적는다
   (`UserTest` 의 2026-08-24 프로필 길이 사고가 예)

### 테스트 금지 사항

```java
// ❌ 테스트에서 프로덕션 로직 복붙
assertThat(result).isEqualTo(price * 1.1);  // 로직을 검증하는 게 아니라 복사한 것

// ✅ 기대값을 하드코딩
assertThat(result).isEqualTo(11000);  // price=10000, tax=10%
```

## 실행

```bash
cd backend

# 전체 테스트
gradle test

# 특정 모듈
gradle :api:test
gradle :domain:test

# 특정 클래스
gradle test --tests "com.studyclub.api.ApiIntegrationTest"
```

> CI(`backend-*.yaml`)는 현재 `bootJar` 만 돌린다. 테스트는 **로컬에서 통과시킨 뒤** PR 을 올린다.
