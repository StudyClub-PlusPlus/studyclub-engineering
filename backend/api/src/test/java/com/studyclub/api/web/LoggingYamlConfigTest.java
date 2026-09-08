package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

/**
 * {@link StructuredLoggingTest} 는 {@code @SpringBootTest(properties = ...)} 로 로깅 설정을
 * 직접 오버라이드해서 부팅한다 — 그래서 Spring Boot 내장 ECS 포매터가 실제로 무엇을 뱉는지는
 * 지키지만, <b>main {@code application.yml} 의 배선 자체가 살아있는지는 전혀 지키지 못한다.</b>
 * 그 테스트의 프로퍼티만으로도 통과하기 때문에, main yml 의 {@code logging:} 블록을 통째로
 * 지우고 돌려도 {@link StructuredLoggingTest} 는 여전히 green 이다.
 *
 * <p>이 프로젝트는 {@code src/test/resources/application.yml} 이 {@code src/main} 의 것을
 * 완전히 <b>shadow</b> 한다(병합이 아니다 — {@code classpath:/application.yml} 조회는 첫 매치
 * 하나만 쓴다). 그래서 {@code @SpringBootTest} 로 부팅해서는 main yml 의 {@code logging:}
 * 블록을 태울 수 없다. 대신 이 테스트는 Spring 을 전혀 띄우지 않고, Gradle 이 테스트를 돌리는
 * 작업 디렉터리({@code backend/api})를 기준으로 main {@code application.yml} 파일을 직접 읽어
 * SnakeYAML(스프링 부트 자체가 이미 끌어오는 전이 의존성이라 새 라이브러리 아님)로 파싱해
 * 구조로 검증한다.
 *
 * <p>이 배선이 조용히 사라지면: 파일 로깅이 아예 안 돌고 → Alloy 가 읽을 파일이 없고 →
 * Loki 가 비고 → 관측 스택 전체가 죽는데, 애플리케이션 자체는 정상 부팅되어 <b>아무 에러도
 * 나지 않는다.</b> 그래서 실제 {@code application.yml} 파일 훼손에 반응하는 가드가 따로
 * 필요하다.
 */
class LoggingYamlConfigTest {

    private static final Path MAIN_YML = Path.of("src/main/resources/application.yml");

    @SuppressWarnings("unchecked")
    private static Map<String, Object> load() throws Exception {
        try (InputStream in = Files.newInputStream(MAIN_YML)) {
            return new Yaml().load(in);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> child(Map<String, Object> map, String key) {
        assertThat(map).as("YAML 에 '%s' 블록이 있어야 한다", key).containsKey(key);
        return (Map<String, Object>) map.get(key);
    }

    private static Map<String, Object> rollingPolicy() throws Exception {
        Map<String, Object> logging = child(load(), "logging");
        Map<String, Object> logback = child(logging, "logback");
        return child(logback, "rollingpolicy");
    }

    @Test
    @DisplayName("성공 - 파일 로깅 env 플레이스홀더(LOG_JSON_FORMAT, LOG_FILE)가 살아있다")
    void fileLoggingPlaceholdersArePresent() throws Exception {
        Map<String, Object> logging = child(load(), "logging");

        Map<String, Object> format = child(child(logging, "structured"), "format");
        assertThat(format.get("file")).isEqualTo("${LOG_JSON_FORMAT:}");

        Map<String, Object> file = child(logging, "file");
        assertThat(file.get("name")).isEqualTo("${LOG_FILE:}");
    }

    @Test
    @DisplayName("성공 - total-size-cap 이 디스크 상한으로 설정돼 있다 (max-history 는 상한이 아니다)")
    void totalSizeCapIsConfigured() throws Exception {
        assertThat(rollingPolicy().get("total-size-cap")).isEqualTo("30MB");
    }

    @Test
    @DisplayName("성공 - file-name-pattern 에 .gz 압축이 없다 (압축되면 Alloy 감시 대상 밖)")
    void fileNamePatternIsNotCompressed() throws Exception {
        Object pattern = rollingPolicy().get("file-name-pattern");
        assertThat(pattern).isNotNull();
        assertThat(pattern.toString()).doesNotContain(".gz");
    }
}
