package com.studyclub.api.study;

import com.studyclub.domain.study.RecruitmentTimeZones;
import java.util.List;

/**
 * 모집 시간대 입력. {@code mode} 를 문자열로 받아 도메인이 검사한다 — enum 역직렬화 실패는 필드 사유 없는 400 이 된다.
 *
 * @param mode {@code unset} · {@code all} · {@code selected}
 * @param zones {@code selected} 일 때만 1개 이상의 IANA. 나머지 방식은 비우거나 생략
 */
public record RecruitmentTimeZonesRequest(String mode, List<String> zones) {

    public RecruitmentTimeZones toDomain() {
        return RecruitmentTimeZones.of(mode, zones);
    }
}
