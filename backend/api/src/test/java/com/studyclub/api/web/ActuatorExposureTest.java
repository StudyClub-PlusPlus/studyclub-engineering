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

/** actuator 가 앱 포트에서 보이지 않는다는 것을 지킨다. 상태코드가 아니라 메트릭 본문이 새는지를 단언한다. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "management.server.port=0",
            "management.endpoints.web.exposure.include=health,info,prometheus"
        })
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
        // 합쳐진 상태에서도 non-null 이므로 앱 포트와 다른지까지 봐야 한다.
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
