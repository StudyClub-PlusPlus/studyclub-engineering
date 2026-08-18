# Testing Guide

## Table of Contents

- [테스트 계층](#테스트-계층)
- [네이밍 규칙](#네이밍-규칙)
- [단위 테스트](#단위-테스트)
- [통합 테스트](#통합-테스트)
- [테스트 작성 원칙](#테스트-작성-원칙)
- [실행](#실행)

## 테스트 계층

| 계층 | 대상 | 도구 | 속도 |
|------|------|------|------|
| 단위 테스트 | 도메인 엔티티, 유틸 | JUnit 5 + AssertJ | 빠름 |
| 슬라이스 테스트 | 컨트롤러, Repository | `@WebMvcTest`, `@DataJpaTest` | 중간 |
| 통합 테스트 | API 전체 흐름 | `@SpringBootTest` + TestRestTemplate | 느림 |

비율 목표: **단위 > 슬라이스 > 통합** (테스트 피라미드)

## 네이밍 규칙

```
src/test/java/com/studyclub/{module}/...
```

- 테스트 클래스: `{대상}Test.java` (단위), `{대상}IntegrationTest.java` (통합)
- 메서드: `should_{기대결과}_when_{조건}` 또는 한글 `@DisplayName`

```java
@DisplayName("스터디 마감 - 이미 마감된 스터디면 예외")
@Test
void should_throw_when_already_closed() { ... }
```

## 단위 테스트

도메인 엔티티의 비즈니스 로직을 Spring 없이 테스트:

```java
class StudyTest {

    @DisplayName("모집 중인 스터디에 멤버를 추가할 수 있다")
    @Test
    void should_add_member_when_recruiting() {
        // given
        Study study = Study.builder()
            .status(StudyStatus.RECRUITING)
            .maxMembers(5)
            .build();

        // when
        study.addMember(1L);

        // then
        assertThat(study.getMembers()).hasSize(1);
    }

    @DisplayName("정원이 찬 스터디에 멤버 추가 시 예외")
    @Test
    void should_throw_when_capacity_full() {
        // given
        Study study = createFullStudy();

        // when & then
        assertThatThrownBy(() -> study.addMember(99L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("정원 초과");
    }
}
```

**핵심**: 도메인 로직 테스트는 DB 도, Spring 도 필요 없다. 순수 Java 객체로 빠르게 검증.

## 통합 테스트

API 엔드포인트 전체 흐름 검증:

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthIntegrationTest {

    @Autowired
    TestRestTemplate restTemplate;

    @DisplayName("Google 로그인 - 유효한 코드로 JWT 발급")
    @Test
    void should_return_jwt_when_valid_google_code() {
        // given
        var request = new GoogleLoginRequest("valid-code", "http://localhost/callback");

        // when
        var response = restTemplate.postForEntity("/auth/google", request, AuthResponse.class);

        // then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().accessToken()).isNotBlank();
    }
}
```

### 슬라이스 테스트

컨트롤러만 띄우기 (`@WebMvcTest`):

```java
@WebMvcTest(StudyController.class)
class StudyControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    StudyService studyService;

    @DisplayName("GET /studies - 스터디 목록 조회")
    @Test
    void should_return_studies() throws Exception {
        given(studyService.findAll()).willReturn(List.of(/* ... */));

        mockMvc.perform(get("/studies")
                .header("Authorization", "Bearer test-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }
}
```

## 테스트 작성 원칙

1. **Given-When-Then** 구조를 지킨다
2. **테스트 당 검증 하나** — 하나의 행위, 하나의 기대 결과
3. **테스트 간 독립** — 순서에 의존하지 않는다, 공유 상태 없음
4. **경계값 테스트** — 정원 0, 1, max, max+1 등
5. **실패 케이스 우선** — 해피 패스보다 예외/에러 케이스를 먼저 작성
6. **테스트 이름으로 스펙 문서** — `@DisplayName` 만 읽어도 요구사항이 보여야 한다

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
./gradlew test

# 특정 모듈
./gradlew :api:test
./gradlew :domain:test

# 특정 클래스
./gradlew test --tests "com.studyclub.domain.study.StudyTest"
```
