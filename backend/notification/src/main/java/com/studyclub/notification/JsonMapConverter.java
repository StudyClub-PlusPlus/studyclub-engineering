package com.studyclub.notification;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Map;
import tools.jackson.databind.json.JsonMapper;

/**
 * {@code NOTIFICATION.PAYLOAD} 컬럼(MySQL {@code JSON} 타입)과 {@code Map<String,Object>} 사이 변환.
 *
 * <p>Hibernate 의 네이티브 JSON 매핑 기능에 기대지 않고, 문자열 컬럼처럼 다루되 마이그레이션에서 컬럼 타입만 {@code JSON} 으로 선언한다 — 가장
 * 단순하고 안전한 방식이다 (specs/notification/spec.md).
 *
 * <p>{@code autoApply = false} — 이 컨버터는 {@code Notification.payload} 에만 명시적으로 붙인다. 다른 곳에 {@code
 * Map<String,Object>} 필드가 생겨도 실수로 같이 걸리지 않게 하기 위해서다.
 */
@Converter(autoApply = false)
public class JsonMapConverter implements AttributeConverter<Map<String, Object>, String> {

    private static final JsonMapper MAPPER = JsonMapper.shared();

    @Override
    public String convertToDatabaseColumn(Map<String, Object> attribute) {
        return attribute == null ? null : MAPPER.writeValueAsString(attribute);
    }

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> convertToEntityAttribute(String dbData) {
        return dbData == null ? null : MAPPER.readValue(dbData, Map.class);
    }
}
