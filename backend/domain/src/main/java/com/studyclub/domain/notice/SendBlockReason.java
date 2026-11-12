package com.studyclub.domain.notice;

/** 지금 공지를 보낼 수 없는 이유 (POL-0010 「발송 한도」). */
public enum SendBlockReason {
    /** 끝난 스터디(종료·마감)다. 새 공지를 보내지 않고, 보낸 기록만 본다. 다른 사유보다 먼저 판정한다. */
    STUDY_ENDED,
    /** 같은 반에서 직전 발송 뒤 1분이 지나지 않았다. */
    COOLDOWN,
    /** 그 반이 오늘(한국 시간) 보낼 수 있는 횟수를 모두 썼다. */
    DAILY_LIMIT
}
