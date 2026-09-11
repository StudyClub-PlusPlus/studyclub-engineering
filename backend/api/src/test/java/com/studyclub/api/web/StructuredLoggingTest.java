package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Alloy 가 읽어갈 <b>파일</b>이 실제로 기계가 파싱 가능한 JSON 인지, 그리고 그 안에 {@code requestId} 가 들어있는지를 지킨다. 이 둘이 이 스택
 * 전체의 전제다.
 *
 * <p>여기가 깨지면 Loki 에는 로그가 쌓이지만 <b>필드 필터가 하나도 안 먹는</b> 상태가 된다 — 대시보드를 다 그린 다음에야 드러나서 되짚기 어렵다.
 *
 * <p>줄을 문자열로만 훑지 않고 실제로 JSON 파싱한다. Spring Boot 내장 ECS 포매터 ({@code
 * ElasticCommonSchemaStructuredLogFormatter})는 로그 레벨을 평평한 {@code "log.level"} 키가 아니라 {@code
 * "log":{"level":...}} 처럼 중첩시킨다 — 필드 순서에 기대는 문자열 포함 검사는 Boot 마이너 업그레이드로 필드 순서가 바뀌면 "포맷이 바뀐 것"과
 * "테스트가 취약한 것"을 구분 못 하고 조용히 깨진다. 그래서 JSON 트리를 파싱해 실제 경로({@code /log/level})로 값을 확인한다. Jackson 은
 * spring-boot-starter-web 이 이미 끌어오는 전이 의존성이라 새 라이브러리가 아니다.
 *
 * <p><b>{@code @BeforeAll}/{@code @AfterAll} 에서 {@code LoggingSystem.cleanUp()} 을 호출하는 이유(실측으로 찾은
 * 함정)</b>: {@code LogbackLoggingSystem} 은 로그 설정을 <b>JVM 당 한 번만</b> 초기화한다 — {@code LoggerContext} 는
 * JVM 싱글턴인데, 거기에 "이미 초기화됨" 마커를 심어두고 ({@code
 * loggerContext.getObject(LoggingSystem.class.getName())}) 두 번째 {@code initialize()} 호출부터는 통째로
 * 건너뛴다(디컴파일로 확인). 그래서 전체 테스트 스위트를 돌리면, 이 클래스보다 <b>먼저</b> 뜨는 다른 {@code @SpringBootTest} 컨텍스트가 있을 때 —
 * 즉 거의 항상 — 이 클래스의 {@code logging.file.name}/{@code logging.structured.format.file} 오버라이드가 통째로 무시되고
 * 파일에 CONSOLE 어펜더만 남아 파일이 아예 안 생긴다. 클래스 하나만 돌리면 통과하고, 스위트 전체를 돌리면 순서에 따라 랜덤하게 깨지는 게 바로 이 증상이다(로컬에서
 * 100% 재현 확인). 컨텍스트가 뜨기 직전에 마커를 지워 우리 컨텍스트만큼은 항상 제대로 재초기화되게 하고, 끝나고 나서도 지워서 이후 테스트 클래스의 재초기화를 우리가
 * 막지 않게 한다.
 *
 * <p>콘솔 설정은 건드리지 않는다. {@code docker logs} 의 가독성은 유지되어야 한다.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "logging.structured.format.file=ecs",
            "logging.file.name=build/test-logs/app.json"
        })
@AutoConfigureTestRestTemplate
class StructuredLoggingTest {

    private static final Path LOG = Path.of("build/test-logs/app.json");
    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired TestRestTemplate rest;

    @BeforeAll
    static void resetLoggingSystemSoOurFileConfigActuallyApplies() {
        LoggingSystem.get(StructuredLoggingTest.class.getClassLoader()).cleanUp();
    }

    @AfterAll
    static void resetLoggingSystemSoLaterTestsAreNotAffectedByUs() {
        LoggingSystem.get(StructuredLoggingTest.class.getClassLoader()).cleanUp();
    }

    @Test
    @DisplayName("성공 - 로그 파일이 ECS JSON 이고 requestId 를 최상위 필드로 담는다")
    void logFileIsEcsJsonWithRequestId() throws Exception {
        // 접근 로그가 남는 경로로 요청한다 (/api/health 는 일부러 제외되는 경로)
        rest.getForEntity("/api/studies", String.class);

        assertThat(LOG).exists();
        List<String> lines = Files.readAllLines(LOG);
        assertThat(lines).isNotEmpty();

        String accessLine =
                lines.stream()
                        .filter(l -> l.contains("/api/studies"))
                        .reduce((first, second) -> second)
                        .orElseThrow(() -> new AssertionError("접근 로그 줄을 찾지 못했다"));

        // 텍스트면 여기서 JsonProcessingException 으로 실패한다 (평문 로그였다면 이 파싱 자체가 깨진다)
        JsonNode json = JSON.readTree(accessLine);

        assertThat(json.path("message").asText()).isNotBlank();
        assertThat(json.path("log").path("level").asText()).isEqualTo("INFO");
        assertThat(json.path("requestId").asText()).isNotBlank();
    }
}
