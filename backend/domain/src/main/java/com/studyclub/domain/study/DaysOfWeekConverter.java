package com.studyclub.domain.study;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;
import java.util.List;

/**
 * {@code List<String>} ↔ VARCHAR 쉼표 구분 문자열 변환.
 *
 * <p>요일 값은 {@code mon} ~ {@code sun} (소문자 3자). 최대 7개이므로 VARCHAR(30)에 여유 있게 들어간다. 빈 리스트와 null 은 모두
 * DB null 로 저장한다 — "미정"을 null 하나로 표현한다.
 */
@Converter
public class DaysOfWeekConverter implements AttributeConverter<List<String>, String> {

    @Override
    public String convertToDatabaseColumn(List<String> attribute) {
        if (attribute == null || attribute.isEmpty()) return null;
        return String.join(",", attribute);
    }

    @Override
    public List<String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) return null;
        return Arrays.stream(dbData.split(",")).toList();
    }
}
