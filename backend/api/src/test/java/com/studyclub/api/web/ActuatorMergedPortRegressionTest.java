package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.micrometer.metrics.test.autoconfigure.AutoConfigureMetrics;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** 관리 포트가 앱 포트와 합쳐져도 actuator 가 인증 없이 새지 않는지 지킨다 (회귀 방지). */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
            "server.port=8080",
            "management.server.port=8080",
            "management.endpoints.web.exposure.include=health,info,prometheus"
        })
@AutoConfigureMockMvc
@AutoConfigureMetrics
class ActuatorMergedPortRegressionTest {

    @Autowired MockMvc mockMvc;

    @Test
    @DisplayName("실패 - management.server.port 가 앱 포트와 합쳐지면 actuator 는 인증 없이 새면 안 된다")
    void actuatorDoesNotLeakWhenManagementPortMergesWithAppPort() throws Exception {
        MvcResult result = mockMvc.perform(get("/actuator/prometheus")).andReturn();

        assertThat(HttpStatus.valueOf(result.getResponse().getStatus()).is2xxSuccessful())
                .as("포트가 합쳐진 상태에서 /actuator/prometheus 가 인증 없이 200 을 주면 안 된다")
                .isFalse();
        assertThat(result.getResponse().getContentAsString())
                .doesNotContain("jvm_memory_used_bytes");
    }
}
