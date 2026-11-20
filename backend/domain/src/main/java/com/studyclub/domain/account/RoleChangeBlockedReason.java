package com.studyclub.domain.account;

/**
 * 계정 권한을 지금 바꿀 수 없는 이유 — {@link Account#roleChangeBlockedReason}. 백오피스 목록이 배지를 잠그는 이유와 권한 변경 API 가
 * 거절하는 이유가 이 하나의 어휘다. 거절은 같은 이름의 ErrorCode 로 나간다(최고 관리자 둘은 403, 나머지 409).
 */
public enum RoleChangeBlockedReason {
    /** 요청자 본인의 계정이다. */
    CANNOT_CHANGE_OWN_ROLE,
    /** 남은 마지막 캡틴(ADMIN)이다 — 내리면 백오피스에 들어갈 사람이 없다. */
    LAST_ADMIN_REQUIRED,
    /** 최고 관리자(env SUPER_ADMIN_EMAILS)인 캡틴이다 — 화면 · API 로는 못 내리고 env 를 고쳐야 바뀐다. */
    SUPER_ADMIN_LOCKED,
    /** 요청자가 최고 관리자가 아니다 — 캡틴을 내리는 것은 최고 관리자만 한다. 크루를 올리는 것은 해당 없다. */
    NOT_SUPER_ADMIN,
    /** 진행 중인 스터디(끝나지 않은 스터디)의 담당 캡틴이다 — 내리면 크루가 담당 캡틴으로 남는다. 담당을 먼저 넘긴다 (POL-0001). */
    OWNS_STUDY
    // 디스코드 미연동 크루를 막던 DISCORD_LINK_REQUIRED 는 2026-10-27 뺐다 — 캡틴에게 디스코드 연동은 필수가 아니다
}
