package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

/** main application.yml 의 logging 배선을 지킨다. test yml 이 main 을 shadow 해 부팅으로는 검증할 수 없다. */
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
