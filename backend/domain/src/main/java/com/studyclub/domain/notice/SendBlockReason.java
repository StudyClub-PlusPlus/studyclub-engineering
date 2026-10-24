package com.studyclub.domain.notice;

/** 지금 공지를 보낼 수 없는 이유 (POL-0010 「발송 한도」). */
public enum SendBlockReason {
    /** 같은 반에서 직전 발송 뒤 1분이 지나지 않았다. */
    COOLDOWN,
    /** 그 반이 오늘(한국 시간) 보낼 수 있는 횟수를 모두 썼다. */
    DAILY_LIMIT
}
