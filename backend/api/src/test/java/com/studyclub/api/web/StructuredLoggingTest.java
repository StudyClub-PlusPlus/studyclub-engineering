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
 * Alloy 가 읽어갈 <b>파일</b>이 기계가 파싱 가능한 JSON 인지, 그 안에 {@code requestId} 가 들어있는지를 지킨다. 이 둘이 이 스택 전체의 전제다
 * — 깨지면 Loki 에는 쌓이는데 필드 필터가 하나도 안 먹는다.
 *
 * <p>문자열 포함이 아니라 JSON 트리를 파싱해 {@code /log/level} 경로로 확인한다(ECS 는 레벨을 중첩시킨다). {@code
 * LoggingSystem.cleanUp()} 은 Logback 이 JVM 당 한 번만 초기화되는 것을 우회하기 위한 것이다 — 없으면 스위트 전체 실행 시 이 클래스의
 * 오버라이드가 무시된다. 배경은 specs/observability-stack/spec.md 참조.
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
