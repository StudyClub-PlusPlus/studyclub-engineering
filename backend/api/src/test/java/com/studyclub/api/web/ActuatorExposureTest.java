package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.env.Environment;
import org.springframework.web.client.RestTemplate;

/**
 * actuator 가 <b>앱 포트에서 보이지 않는다</b>는 것을 지킨다.
 *
 * <p>운영에서 {@code /actuator} 는 인증 없이 200 이었다. 거기에 prometheus 엔드포인트를 얹으면
 * URI별 호출량·응답시간·DB 커넥션풀·JVM 상태가 그대로 인터넷에 공개된다. 이 테스트는 누군가
 * {@code management.server.port} 를 지우거나 SecurityConfig 에 {@code /actuator/**} 를 다시
 * 넣었을 때 <b>빌드에서 터뜨리는</b> 역할을 한다.
 *
 * <p>상태코드가 아니라 <b>메트릭 본문이 새는지</b>를 단언한다 — 401 이든 404 든 안 새면 통과다.
 *
 * <p>{@code @AutoConfigureObservability} 가 필요하다: {@code @SpringBootTest} 는 기본적으로
 * {@code management.defaults.metrics.export.enabled=false} 를 주입해 prometheus 같은 실제
 * exporter 를 꺼버린다(테스트가 실제 메트릭 백엔드로 값을 내보내지 않게 하는 Boot 의 기본 동작).
 * 이 테스트는 prometheus 엔드포인트가 실제로 뜨는지를 검증해야 하므로 그 기본을 되돌린다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureObservability
class ActuatorExposureTest {

    @Autowired
    TestRestTemplate rest;

    @Autowired
    Environment env;

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

        String body = new RestTemplate()
                .getForObject("http://localhost:" + managementPort + "/actuator/prometheus", String.class);

        assertThat(body).contains("jvm_memory_used_bytes");
    }

    @Test
    @DisplayName("성공 - 헬스체크는 앱 포트의 /api/health 로 대체된다")
    void applicationHealthEndpointRemains() {
        assertThat(rest.getForEntity("/api/health", String.class).getStatusCode().is2xxSuccessful())
                .isTrue();
    }
}
