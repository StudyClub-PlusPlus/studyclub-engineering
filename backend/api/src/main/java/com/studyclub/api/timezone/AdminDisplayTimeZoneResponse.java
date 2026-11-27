package com.studyclub.api.timezone;

import com.studyclub.domain.account.Account;

/**
 * GET · PATCH /api/admin/me/display-time-zone — specs/timezone/spec.md §7
 *
 * @param timeZone 저장된 헤더 값. 없으면 {@code null}
 * @param profileTimeZone 회원 프로필 시간대
 * @param effectiveDisplayTimeZone 저장된 헤더 → 프로필 → 서울
 */
public record AdminDisplayTimeZoneResponse(
        String timeZone, String profileTimeZone, String effectiveDisplayTimeZone) {

    static AdminDisplayTimeZoneResponse from(Account account) {
        return new AdminDisplayTimeZoneResponse(
                account.getAdminDisplayTimeZone(),
                account.getTimeZone(),
                DisplayTimeZoneResolver.effectiveBackOffice(account));
    }
}
