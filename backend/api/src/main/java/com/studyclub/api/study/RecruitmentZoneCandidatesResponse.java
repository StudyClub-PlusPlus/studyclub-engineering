package com.studyclub.api.study;

import com.studyclub.common.time.TimeZoneLabels;
import java.util.List;

/**
 * GET /api/studies/recruitment-zones — 사이트 목록 모집 시간대 필터 후보. 조합 옵션은 없다: 한국 + LA 스터디는 두 줄로 나온다.
 * {@code all} · {@code unset} 스터디는 후보를 만들지 않는다.
 */
public record RecruitmentZoneCandidatesResponse(List<Item> items) {

    /**
     * @param recruitmentZoneShortLabel 서울 {@code 한국}, LA {@code 미국 · LA}, 나머지 {@code 나라 · 도시}
     */
    public record Item(String timeZone, String recruitmentZoneShortLabel) {
        static Item of(String timeZone) {
            return new Item(timeZone, TimeZoneLabels.shortLabel(timeZone));
        }
    }
}
