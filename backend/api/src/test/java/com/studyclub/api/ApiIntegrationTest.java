package com.studyclub.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;

/**
 * API 코어 경로 통합 테스트 — <b>성공 하나, 실패 여럿.</b>
 *
 * <p>여기서 지키는 것은 기능이 아니라 <b>계약</b>이다:
 * <ol>
 *   <li>성공 응답에 {@code success} 같은 래퍼 필드가 없다 (payload 직접)</li>
 *   <li>실패 응답은 어디서 나든 {@code {errorCode, errorMessage}} 한 모양이다 —
 *       컨트롤러가 던지든, 시큐리티 필터가 막든</li>
 * </ol>
 *
 * <p>2번이 특히 잘 깨진다. 시큐리티 필터는 {@code @RestControllerAdvice} 앞에서 응답을 끝내기
 * 때문에, 핸들러만 고치고 EntryPoint 를 잊으면 <b>인증 실패만 조용히 빈 바디</b>가 된다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ApiIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    /**
     * 레거시 {@code HttpURLConnection} 은 <b>바디가 있는 POST 에 401 이 돌아오면</b> 인증 재시도
     * 로직에 걸려 응답을 못 읽고 I/O 에러를 던진다("cannot retry due to server authentication").
     * 서버가 아니라 클라이언트 제약이다 — curl 로는 401 바디가 정상적으로 보인다.
     * 인증 실패 경로를 검증하는 게 이 클래스의 절반이므로 java.net.http 기반 팩토리로 바꾼다.
     */
    @BeforeEach
    void useModernHttpClient() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    @Test
    @DisplayName("성공 - 공개 엔드포인트는 payload 를 그대로 준다 (success 래퍼 없음)")
    void publicEndpointReturnsBarePayload() {
        // when
        var response = rest.getForEntity("/api/studies", String.class);

        // then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).startsWith("[").contains("알고리즘 스터디");
        assertThat(response.getBody()).doesNotContain("success");
    }

    @Test
    @DisplayName("성공 - 헬스 체크")
    void health() {
        var response = rest.getForEntity("/api/health", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("status", "UP");
    }

    @Test
    @DisplayName("실패 - 토큰 없이 /auth/me → 401 + errorCode UNAUTHORIZED (시큐리티가 막아도 같은 모양)")
    void unauthenticatedReturnsErrorResponse() {
        var response = rest.getForEntity("/auth/me", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
        assertThat(response.getBody().get("errorMessage")).asString().isNotBlank();
        assertThat(response.getBody()).doesNotContainKey("success");
    }

    @Test
    @DisplayName("실패 - code 없이 소셜 로그인 → 400 + errorCode INVALID_INPUT (BusinessException 경로)")
    void socialLoginWithoutCode() {
        var response = rest.postForEntity("/auth/social-login", Map.of("platform", "CORE"), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(response.getBody().get("errorMessage")).asString().contains("code");
    }

    @Test
    @DisplayName("실패 - 위조된 refresh token → 401 + errorCode UNAUTHORIZED (내부 예외가 새지 않는다)")
    void refreshWithBogusToken() {
        var response = rest.postForEntity("/auth/refresh", Map.of("refreshToken", "not-a-jwt"), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
        // 파서 예외 클래스명·스택이 밖으로 나가면 안 된다
        assertThat(response.getBody().get("errorMessage")).asString().doesNotContain("Exception");
    }

    @Test
    @DisplayName("실패 - 없는 경로도 인증부터 막는다(401). 500 으로 뭉뚱그려지지 않고 같은 에러 모양을 쓴다")
    void unknownPathIsRejectedWithSameShape() {
        // 화이트리스트 밖은 전부 authenticated() 이므로 라우팅보다 인증이 먼저다.
        // 없는 경로를 404 로 알려주면 어떤 엔드포인트가 있는지 밖에서 훑을 수 있다.
        var response = rest.getForEntity("/api/nope", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
        assertThat(response.getBody()).doesNotContainKeys("timestamp", "path", "success");
    }
}
