package com.studyclub.domain.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.time.TimeZoneIds;
import com.studyclub.common.time.TimeZoneLabels;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 모집 시간대 — 모집 안내 · 사이트 필터에만 쓴다. 신청을 막거나 반을 나누지 않는다 (POL-0006). specs/timezone/spec.md §3.2
 *
 * @param zones {@code SELECTED} 일 때만 1개 이상, 정본 IANA, 중복 없음. 나머지 방식은 빈 목록
 */
public record RecruitmentTimeZones(RecruitmentTimeZoneMode mode, List<String> zones) {

    public static final RecruitmentTimeZones UNSET =
            new RecruitmentTimeZones(RecruitmentTimeZoneMode.UNSET, List.of());

    public RecruitmentTimeZones {
        if (mode == null) {
            throw invalid("mode 는 unset · all · selected 중 하나여야 합니다.");
        }
        zones = zones == null ? List.of() : List.copyOf(zones);
        if (mode != RecruitmentTimeZoneMode.SELECTED && !zones.isEmpty()) {
            throw invalid("zones 는 mode=selected 일 때만 보낼 수 있습니다.");
        }
        if (mode == RecruitmentTimeZoneMode.SELECTED && zones.isEmpty()) {
            throw invalid("zones 를 1개 이상 고르세요.");
        }
    }

    /**
     * 요청 값을 정본 ID 로 바꿔 만든다. 정규화 뒤 같은 지역이 둘이면 400 이다 — 화면이 같은 지역을 두 번 고르게 두지 않는다.
     *
     * @param modeCode {@code unset} · {@code all} · {@code selected}
     */
    public static RecruitmentTimeZones of(String modeCode, List<String> rawZones) {
        RecruitmentTimeZoneMode mode =
                RecruitmentTimeZoneMode.fromCode(modeCode)
                        .orElseThrow(() -> invalid("mode 는 unset · all · selected 중 하나여야 합니다."));
        List<String> zones = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (String raw : rawZones == null ? List.<String>of() : rawZones) {
            String zone =
                    TimeZoneIds.normalize(raw)
                            .orElseThrow(() -> invalid("zones 에 올바르지 않은 시간대가 있습니다: " + raw));
            if (!seen.add(zone)) {
                throw invalid("zones 에 같은 시간대가 두 번 있습니다: " + zone);
            }
            zones.add(zone);
        }
        return new RecruitmentTimeZones(mode, zones);
    }

    /** 사이트 목록 필터 — {@code all} · {@code unset} 은 어느 지역을 골라도 통과, {@code selected} 는 하나라도 맞으면. */
    public boolean matches(String zone) {
        return mode != RecruitmentTimeZoneMode.SELECTED || zones.contains(zone);
    }

    /** 카드 · 상세의 모집 시간대 한 줄. Playground {@code recruitmentZoneLabel} 과 같은 문구 · 순서. */
    public String label() {
        return switch (mode) {
            case ALL -> "모든 시간대에서 모집";
            case UNSET -> "미정";
            case SELECTED ->
                    String.join(
                            " / ",
                            TimeZoneLabels.sorted(zones).stream()
                                    .map(TimeZoneLabels::shortLabel)
                                    .toList());
        };
    }

    private static BusinessException invalid(String reason) {
        return new BusinessException(ErrorCode.INVALID_INPUT, "recruitmentTimeZones: " + reason);
    }
}
