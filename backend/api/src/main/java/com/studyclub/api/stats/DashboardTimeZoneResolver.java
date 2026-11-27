package com.studyclub.api.stats;

import com.studyclub.api.timezone.DisplayTimeZoneResolver;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

/**
 * 대시보드 집계 시간대 — 헤더(Query) → 저장된 헤더 → 프로필 → 서울. 유효한 Query 를 프로필로 덮어쓰지 않는다 (specs/dashboard/spec.md
 * §2.2.1).
 */
@Component
public class DashboardTimeZoneResolver {

    private final DisplayTimeZoneResolver displayTimeZoneResolver;

    public DashboardTimeZoneResolver(DisplayTimeZoneResolver displayTimeZoneResolver) {
        this.displayTimeZoneResolver = displayTimeZoneResolver;
    }

    /**
     * @param timeZoneQuery 화면 헤더 값. null 이면 생략이며, 빈 값·무효 값은 400이다.
     * @param accountId 조회자. 요청마다 최신 계정 값을 읽는다.
     */
    public ZoneId resolve(String timeZoneQuery, Long accountId) {
        return ZoneId.of(
                displayTimeZoneResolver.forBackOffice(timeZoneQuery, "timeZone", accountId));
    }
}
