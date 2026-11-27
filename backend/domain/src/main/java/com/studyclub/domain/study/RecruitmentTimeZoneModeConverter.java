package com.studyclub.domain.study;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * {@link RecruitmentTimeZoneMode} ↔ {@code RECRUITMENT_TZ_MODE}. 모르는 값 · 빈 값은 {@code UNSET} 으로 읽는다
 * — stage 는 Hibernate 가 컬럼을 더해 기존 행이 빈 문자열일 수 있다.
 */
@Converter
public class RecruitmentTimeZoneModeConverter
        implements AttributeConverter<RecruitmentTimeZoneMode, String> {

    @Override
    public String convertToDatabaseColumn(RecruitmentTimeZoneMode attribute) {
        return (attribute == null ? RecruitmentTimeZoneMode.UNSET : attribute).code();
    }

    @Override
    public RecruitmentTimeZoneMode convertToEntityAttribute(String dbData) {
        return RecruitmentTimeZoneMode.fromCode(dbData).orElse(RecruitmentTimeZoneMode.UNSET);
    }
}
