package com.studyclub.domain.account;

/**
 * 계정 권한을 지금 바꿀 수 없는 이유 — {@link Account#roleChangeBlockedReason}. 백오피스 목록이 배지를 잠그는 이유와 권한 변경 API 가
 * 거절하는 이유가 이 하나의 어휘다. 거절은 같은 이름의 ErrorCode(409)로 나간다.
 */
public enum RoleChangeBlockedReason {
    /** 요청자 본인의 계정이다. */
    CANNOT_CHANGE_OWN_ROLE,
    /** 남은 마지막 캡틴(ADMIN)이다 — 내리면 백오피스에 들어갈 사람이 없다. */
    LAST_ADMIN_REQUIRED,
    /** 디스코드를 연동하지 않은 크루(MEMBER)다 — 캡틴은 디스코드 연동이 필수라 올릴 수 없다 (10-24 회의, STD-05). */
    DISCORD_LINK_REQUIRED
}
