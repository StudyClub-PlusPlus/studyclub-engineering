package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.metrics.test.autoconfigure.AutoConfigureMetrics;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.web.client.RestTemplate;

/**
 * actuator 가 <b>앱 포트에서 보이지 않는다</b>는 것을 지킨다. 운영에서 {@code /actuator} 는 인증 없이 200 이었고, 거기 prometheus 를
 * 얹으면 URI별 호출량·DB 커넥션풀·JVM 상태가 그대로 공개된다.
 *
 * <p>상태코드가 아니라 <b>메트릭 본문이 새는지</b>를 단언한다. {@code @AutoConfigureMetrics} 는 {@code @SpringBootTest} 가
 * 기본으로 끄는 실제 exporter 를 되살려, "없어서 안 샌 것"과 "막아서 안 샌 것"을 구분하기 위한 것이다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@AutoConfigureMetrics
class ActuatorExposureTest {

    @Autowired TestRestTemplate rest;

    @Autowired Environment env;

    @Test
    @DisplayName("실패 - 앱 포트에서는 actuator 메트릭이 새지 않는다 (외부 노출 회귀 방지)")
    void actuatorIsNotServedFromApplicationPort() {
        var metrics = rest.getForEntity("/actuator/prometheus", String.class);
        assertThat(metrics.getStatusCode().is2xxSuccessful()).isFalse();
        assertThat(metrics.getBody()).doesNotContain("jvm_memory_used_bytes");

        var health = rest.getForEntity("/actuator/health", String.class);
        assertThat(health.getStatusCode().is2xxSuccessful()).isFalse();
    }

    @Test
    @DisplayName("성공 - 관리 포트에서는 prometheus 메트릭이 나온다")
    void prometheusIsServedFromManagementPort() {
        String managementPort = env.getProperty("local.management.port");
        String serverPort = env.getProperty("local.server.port");
        // isNotNull() 만으로는 포트가 실제로 분리됐는지 증명하지 못한다 — 합쳐진 상태에서도
        // local.management.port 는 non-null 이다(=앱 포트와 같은 값). 앱 포트와 달라야만
        // "분리됨" 을 실제로 검증하는 것이다.
        assertThat(managementPort).as("관리 포트가 앱 포트와 달라야 한다").isNotNull().isNotEqualTo(serverPort);

        String body =
                new RestTemplate()
                        .getForObject(
                                "http://localhost:" + managementPort + "/actuator/prometheus",
                                String.class);

        assertThat(body).contains("jvm_memory_used_bytes");
    }

    @Test
    @DisplayName("성공 - 헬스체크는 앱 포트의 /api/health 로 대체된다")
    void applicationHealthEndpointRemains() {
        assertThat(rest.getForEntity("/api/health", String.class).getStatusCode().is2xxSuccessful())
                .isTrue();
    }
}
