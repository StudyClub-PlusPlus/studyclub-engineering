package com.studyclub.api.study;

import com.studyclub.common.time.TimeZoneLabels;
import com.studyclub.domain.study.RecruitmentTimeZones;
import java.util.List;

/** 응답의 모집 시간대 — specs/timezone/spec.md §3.2. {@code zones} 는 표시 순서(한국 → 미국 → 캐나다 …). */
public record RecruitmentTimeZonesView(String mode, List<String> zones) {

    public static RecruitmentTimeZonesView from(RecruitmentTimeZones timeZones) {
        return new RecruitmentTimeZonesView(
                timeZones.mode().code(), TimeZoneLabels.sorted(timeZones.zones()));
    }
}
