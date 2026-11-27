package com.studyclub.api.event;

import com.studyclub.domain.event.mail.ClubEventMail;
import com.studyclub.domain.event.mail.ClubEventMailAudience;
import com.studyclub.domain.event.mail.ClubEventMailFormat;
import com.studyclub.domain.event.mail.ClubEventMailType;
import java.time.Instant;
import java.util.List;

/** 메일 이력 상세 · 보내기 응답. 받는 주소는 언제나 서버가 가린 값이다. */
public record AdminClubEventMailDetailResponse(
        Long mailId,
        ClubEventMailType type,
        String subject,
        String body,
        ClubEventMailFormat format,
        ClubEventMailAudience audience,
        int recipientCount,
        List<String> maskedRecipients,
        Instant createdAt) {

    static AdminClubEventMailDetailResponse of(ClubEventMail mail, List<String> maskedRecipients) {
        return new AdminClubEventMailDetailResponse(
                mail.getId(),
                mail.getType(),
                mail.getSubject(),
                mail.getBody(),
                mail.getFormat(),
                mail.getAudience(),
                mail.getRecipientCount(),
                maskedRecipients,
                mail.getCreatedAt());
    }
}
