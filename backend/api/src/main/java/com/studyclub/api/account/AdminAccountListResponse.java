package com.studyclub.api.account;

import com.studyclub.domain.account.RoleChangeBlockedReason;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import java.util.List;

/** 백오피스 회원 목록 응답 (specs/admin-users/spec.md). 이메일은 가려서만 내보낸다 — 원본은 「이메일 보기」 API 로만. */
public record AdminAccountListResponse(
        List<AccountSummary> items, long total, int offset, int limit) {

    /**
     * @param name 온보딩 전이면 null — 그때의 닉네임은 임시값이라 사람 이름이 아니다
     * @param navigatorOf 담당 스터디. 없으면 빈 목록
     * @param dormant 참여 중인 스터디가 하나도 없다 (계정 상태가 아니라 참여 이력으로 판정)
     * @param roleChangeBlockedReason 지금 이 행의 권한을 바꿀 수 없는 이유. 바꿀 수 있으면 null
     */
    public record AccountSummary(
            Long id,
            String name,
            String maskedEmail,
            SystemRole systemRole,
            List<NavigatorStudy> navigatorOf,
            boolean dormant,
            Instant joinedAt,
            RoleChangeBlockedReason roleChangeBlockedReason) {}

    public record NavigatorStudy(Long studyId, String title) {}
}
