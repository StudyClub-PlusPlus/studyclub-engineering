package com.studyclub.api.event;

import com.studyclub.domain.event.mail.ClubEventMailAudience;
import com.studyclub.domain.event.mail.ClubEventMailFormat;
import com.studyclub.domain.event.mail.ClubEventMailType;
import com.studyclub.domain.event.mail.MailBlockedReason;

/**
 * 작성 창의 공통 미리보기 · 받는 사람 수 · 보낼 수 있는지. 본문은 {@code {{nickname}}} 만 원문이다. 템플릿이 없으면 제목 · 본문 · 형식이 null.
 */
public record AdminClubEventMailPreviewResponse(
        ClubEventMailType type,
        ClubEventMailAudience audience,
        Long templateId,
        boolean templateExists,
        String subject,
        String body,
        ClubEventMailFormat format,
        String displayTimeZone,
        int recipientCount,
        boolean canSend,
        MailBlockedReason blockedReason) {}
