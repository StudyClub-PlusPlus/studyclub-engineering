package com.studyclub.domain.event.mail;

import com.studyclub.domain.event.ChannelDraft;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventDraft;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

final class EventMailFixtures {

    private EventMailFixtures() {}

    static ClubEvent event(
            Instant startsAt, Instant endsAt, String timeZone, List<ChannelDraft> channels) {
        EventDraft draft =
                new EventDraft(
                        "연말 네트워킹 밋업",
                        "한 해를 마무리하며 크루끼리 만나요",
                        "행사 소개",
                        timeZone,
                        startsAt,
                        endsAt,
                        startsAt.minus(Duration.ofDays(1)),
                        EventConfirmation.REVIEW,
                        channels,
                        List.of());
        return ClubEvent.publish(draft, 1L, "key", startsAt.minus(Duration.ofDays(2)));
    }

    static ClubEvent hybrid(String onlineUrl) {
        return event(
                Instant.parse("2026-12-05T10:00:00Z"),
                Instant.parse("2026-12-05T13:00:00Z"),
                "Asia/Seoul",
                List.of(
                        ChannelDraft.online(100, onlineUrl),
                        ChannelDraft.offline(40, "서울 강남구 ○○빌딩 5층")));
    }
}
