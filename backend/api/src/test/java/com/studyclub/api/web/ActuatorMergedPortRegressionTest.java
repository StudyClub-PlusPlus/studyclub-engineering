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

/**
 * {@code management.server.port} 설정이 사라져 관리 포트와 앱 포트가 "합쳐진" 상태를 재현한다.
 *
 * <p>{@link ActuatorExposureTest} 는 관리 포트가 정상적으로 분리된 상태만 검증한다. 하지만 이 Task 의 진짜 요건은 "오늘 안 새는 것"이 아니라
 * <b>"나중에 누군가 {@code management.server.port} 를 지워도 조용히 다시 새지 않는 것"</b>이다 — {@code SecurityConfig}
 * 에서 원래 있던 {@code /actuator/**} permitAll 을 지운 이유가 정확히 이거다. 이 테스트는 {@code
 * management.server.port=8080} 을 주고 {@code server.port} 는 비워서(=Boot 의 기본 8080) {@code
 * ManagementPortType.get()} 이 {@code SAME} 을 반환하도록 만들어 그 시나리오를 직접 재현한다 — 이러면 actuator 는 별도 자식 컨텍스트
 * 없이 앱과 같은 DispatcherServlet 에 매핑된다.
 *
 * <p>이 테스트가 초록이려면 두 가지가 모두 지켜져야 한다:
 *
 * <ul>
 *   <li>{@code managementChain} 이 포트가 실제로 분리돼 있을 때만 {@code /actuator/**} 를 permit 해야 한다 (경로만 보고
 *       permit 하면 이 테스트에서 바로 샌다).
 *   <li>{@code filterChain} 의 {@code anyRequest().authenticated()} 가 {@code /actuator/**} 에도 적용돼야
 *       한다 (거기 permitAll 을 다시 넣으면 이 테스트에서 바로 샌다).
 * </ul>
 *
 * <p>{@code @AutoConfigureMetrics} 로 실제 prometheus 레지스트리를 켜서, 이 테스트가 "엔드포인트가 아예 없어서 안 샌 것"이 아니라
 * "시큐리티가 막아서 안 샌 것"임을 보장한다.
 *
 * <p>{@code server.port} 를 명시하지 않고 {@code management.server.port=8080} 만 주면 {@code
 * ManagementPortType.get()} 은 "{@code serverPort == null && managementPort == 8080}" 경로로만 SAME 을
 * 반환한다 — 즉 "8080 이라는 기본값"과 "test yml 에 {@code server.port} 가 없다"는 두 우연이 겹쳐야만 성립한다. {@code
 * server.port=8080} 을 여기서 명시해 "포트 값이 같으면 SAME"이라는 세 번째(명시적 동등) 경로로 SAME 을 만든다 — 다음 사람이 test yml 에
 * {@code server.port} 를 추가해도(다른 테스트와의 충돌 회피 등으로) 이 시나리오는 계속 재현된다.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {"server.port=8080", "management.server.port=8080"})
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
