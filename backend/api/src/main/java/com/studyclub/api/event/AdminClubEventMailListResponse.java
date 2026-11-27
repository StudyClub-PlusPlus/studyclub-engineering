package com.studyclub.api.event;

import com.studyclub.domain.event.mail.ClubEventMail;
import com.studyclub.domain.event.mail.ClubEventMailAudience;
import java.time.Instant;
import java.util.List;

/** 메일 이력 한 페이지 — 운영자가 보낸 메일만. */
public record AdminClubEventMailListResponse(List<Item> items, long total, int offset, int limit) {

    public record Item(
            Long mailId,
            String subject,
            ClubEventMailAudience audience,
            int recipientCount,
            Instant createdAt) {

        static Item of(ClubEventMail mail) {
            return new Item(
                    mail.getId(),
                    mail.getSubject(),
                    mail.getAudience(),
                    mail.getRecipientCount(),
                    mail.getCreatedAt());
        }
    }
}
