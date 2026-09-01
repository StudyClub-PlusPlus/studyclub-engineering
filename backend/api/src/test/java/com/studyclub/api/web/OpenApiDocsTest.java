package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;

/**
 * API 문서가 <b>토큰 없이 열린다</b>는 것과, 스펙에 실제 엔드포인트가 들어있다는 것을 지킨다.
 *
 * <p>이게 없으면 SecurityConfig 화이트리스트에서 한 줄만 빠져도 문서가 조용히 401 이 된다.
 * 특히 {@code /webjars/**} 는 UI 가 아니라 UI 가 로드하는 JS 라 빠져도 페이지 자체는 200 이고,
 * 브라우저에서 빈 화면으로만 드러난다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OpenApiDocsTest {

    @Autowired
    TestRestTemplate rest;

    @Test
    @DisplayName("성공 - /v3/api-docs 는 인증 없이 열리고 실제 엔드포인트를 담는다")
    void apiDocsArePublicAndListEndpoints() {
        var response = rest.getForEntity("/v3/api-docs", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("/auth/social-login")
                .contains("/api/studies")
                // 전역 커스터마이저가 붙인 공통 에러 스키마
                .contains("errorCode");
    }

    @Test
    @DisplayName("성공 - Scalar UI 와 그 JS 번들이 인증 없이 열린다 (JS 가 막히면 빈 화면)")
    void scalarUiAndItsBundleArePublic() {
        assertThat(rest.getForEntity("/scalar", String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(rest.getForEntity("/scalar/scalar.js", String.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }
}
