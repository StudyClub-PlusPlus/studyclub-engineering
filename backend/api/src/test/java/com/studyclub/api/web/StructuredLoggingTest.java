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

/** Alloy 가 읽어갈 파일이 파싱 가능한 JSON 이고 그 안에 requestId 가 있는지 지킨다. */
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
        rest.getForEntity("/api/studies", String.class);

        assertThat(LOG).exists();
        List<String> lines = Files.readAllLines(LOG);
        assertThat(lines).isNotEmpty();

        String accessLine =
                lines.stream()
                        .filter(l -> l.contains("/api/studies"))
                        .reduce((first, second) -> second)
                        .orElseThrow(() -> new AssertionError("접근 로그 줄을 찾지 못했다"));

        JsonNode json = JSON.readTree(accessLine);

        assertThat(json.path("message").asText()).isNotBlank();
        assertThat(json.path("log").path("level").asText()).isEqualTo("INFO");
        assertThat(json.path("requestId").asText()).isNotBlank();
    }
}
