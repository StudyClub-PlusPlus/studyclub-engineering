package com.studyclub.api.study;

import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** H2에는 MySQL JSON 읽기 함수가 없다. 로컬 단위 환경용이며 같은 테스트를 실제 MySQL에서도 실행한다. */
public final class H2StudyJsonFunctions {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private H2StudyJsonFunctions() {}

    static void install(JdbcTemplate jdbc) {
        for (String method : new String[] {"valid", "type", "unquote", "extract", "length"}) {
            jdbc.execute(
                    "CREATE ALIAS IF NOT EXISTS JSON_"
                            + method.toUpperCase(java.util.Locale.ROOT)
                            + " FOR '"
                            + H2StudyJsonFunctions.class.getName()
                            + "."
                            + method
                            + "'");
        }
    }

    public static Integer valid(String json) {
        if (json == null) return null;
        try {
            return MAPPER.readTree(json) == null ? 0 : 1;
        } catch (RuntimeException e) {
            return 0;
        }
    }

    public static String type(String json) {
        if (json == null) return null;
        JsonNode node = MAPPER.readTree(json);
        if (node.isArray()) return "ARRAY";
        if (node.isObject()) return "OBJECT";
        if (node.isString()) return "STRING";
        if (node.isNull()) return "NULL";
        return "SCALAR";
    }

    public static String unquote(String json) {
        if (json == null) return null;
        JsonNode node = MAPPER.readTree(json);
        return node.isString() ? node.asString() : json;
    }

    public static String extract(String json, String path) {
        if (json == null) return null;
        if (!"$.questions".equals(path)) throw new IllegalArgumentException("지원하지 않는 테스트 경로");
        JsonNode node = MAPPER.readTree(json).get("questions");
        return node == null ? null : node.toString();
    }

    public static Integer length(String json) {
        if (json == null) return null;
        JsonNode node = MAPPER.readTree(json);
        return node.isContainer() ? node.size() : 1;
    }
}
