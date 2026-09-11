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
 * main {@code application.yml} 의 {@code logging:} 배선이 살아있는지를 지킨다. {@link StructuredLoggingTest} 는
 * 프로퍼티를 직접 주입해 부팅하므로 main yml 을 통째로 지워도 green 이다.
 *
 * <p>{@code src/test/resources/application.yml} 이 main 을 shadow 해서 {@code @SpringBootTest} 로는 태울 수
 * 없다. 그래서 Spring 을 띄우지 않고 파일을 직접 읽어 SnakeYAML 로 검증한다. 이 배선이 사라지면 관측 스택은 죽는데 앱은 정상 부팅되어 아무 에러도 안 난다.
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
