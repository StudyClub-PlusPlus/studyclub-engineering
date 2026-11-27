package com.studyclub.domain.event.mail;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.event.ChannelDraft;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.EventChannel;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class EventMailValuesTest {

    @Nested
    @DisplayName("일정 문자열 — ko-KR M월 d일 (요일) HH:mm, 약어는 그 시각의 것")
    class Schedule {

        @ParameterizedTest(name = "{0} {1}")
        @CsvSource({
            "Asia/Seoul, 2026-12-05T10:00:00Z, 12월 5일 (토) 19:00 ~ 12월 5일 (토) 22:00 KST",
            "America/New_York, 2026-12-05T15:00:00Z, 12월 5일 (토) 10:00 ~ 12월 5일 (토) 13:00 EST",
            "America/New_York, 2026-07-10T14:00:00Z, 7월 10일 (금) 10:00 ~ 7월 10일 (금) 13:00 EDT",
            "America/Toronto, 2026-12-05T15:00:00Z, 12월 5일 (토) 10:00 ~ 12월 5일 (토) 13:00 EST",
            "America/Toronto, 2026-07-10T14:00:00Z, 7월 10일 (금) 10:00 ~ 7월 10일 (금) 13:00 EDT",
            "America/Los_Angeles, 2026-12-05T18:00:00Z, 12월 5일 (토) 10:00 ~ 12월 5일 (토) 13:00 PST",
            "America/Los_Angeles, 2026-07-10T17:00:00Z, 7월 10일 (금) 10:00 ~ 7월 10일 (금) 13:00 PDT",
            "America/Vancouver, 2026-01-10T18:00:00Z, 1월 10일 (토) 10:00 ~ 1월 10일 (토) 13:00 PST",
            "America/Vancouver, 2026-07-10T17:00:00Z, 7월 10일 (금) 10:00 ~ 7월 10일 (금) 13:00 PCT",
            "America/Vancouver, 2026-12-05T17:00:00Z, 12월 5일 (토) 10:00 ~ 12월 5일 (토) 13:00 PCT"
        })
        void zones(String zone, String start, String expected) {
            Instant startsAt = Instant.parse(start);
            ClubEvent event =
                    EventMailFixtures.event(
                            startsAt,
                            startsAt.plusSeconds(3 * 3600),
                            "Asia/Seoul",
                            List.of(ChannelDraft.online(10, null)));

            assertThat(EventMailValues.schedule(event, ZoneId.of(zone))).isEqualTo(expected);
        }

        @Test
        @DisplayName("종료 시각이 없으면 시작 뒤에 약어 하나")
        void withoutEnd() {
            ClubEvent event =
                    EventMailFixtures.event(
                            Instant.parse("2026-11-28T15:00:00Z"),
                            null,
                            "America/New_York",
                            List.of(ChannelDraft.online(10, null)));

            assertThat(EventMailValues.schedule(event, ZoneId.of("America/New_York")))
                    .isEqualTo("11월 28일 (토) 10:00 EST");
        }

        @Test
        @DisplayName("개인별 시간대 — 프로필 → 신청 당시 → 행사 순, 빈 값은 건너뛴다")
        void recipientZone() {
            assertThat(
                            EventMailValues.recipientZone(
                                    "America/Toronto", "Asia/Seoul", "America/Vancouver"))
                    .isEqualTo(ZoneId.of("America/Toronto"));
            assertThat(EventMailValues.recipientZone(null, "Asia/Seoul", "America/Vancouver"))
                    .isEqualTo(ZoneId.of("Asia/Seoul"));
            assertThat(EventMailValues.recipientZone(" ", null, "America/Vancouver"))
                    .isEqualTo(ZoneId.of("America/Vancouver"));
        }
    }

    @Nested
    @DisplayName("참여 안내")
    class Participation {

        @Test
        @DisplayName("대상 ALL + 혼합 행사는 온라인 먼저 두 줄, 방식 하나면 그 값만")
        void hybridAll() {
            ClubEvent event = EventMailFixtures.hybrid("https://meet.example.com/abc");

            assertThat(EventMailValues.participation(event, null))
                    .isEqualTo("온라인: https://meet.example.com/abc\n오프라인: 서울 강남구 ○○빌딩 5층");
            assertThat(EventMailValues.participation(event, EventChannel.OFFLINE))
                    .isEqualTo("서울 강남구 ○○빌딩 5층");
            assertThat(EventMailValues.participation(event, EventChannel.ONLINE))
                    .isEqualTo("https://meet.example.com/abc");
        }

        @Test
        @DisplayName("온라인 링크가 비었으면 추후 안내 문구")
        void onlineUrlPending() {
            ClubEvent event = EventMailFixtures.hybrid(null);

            assertThat(EventMailValues.participation(event, EventChannel.ONLINE))
                    .isEqualTo("온라인 참여 링크는 추후 안내드립니다.");
        }
    }

    @Nested
    @DisplayName("PAYLOAD")
    class Payloads {

        @Test
        @DisplayName("안내 공통 본문에는 nickname 이 없고, 대상 ALL 의 방식 이름은 행사 형식 이름")
        void commonAnnouncement() {
            ClubEvent event = EventMailFixtures.hybrid("https://meet.example.com/abc");

            var values =
                    EventMailValues.announcement(event, null, ZoneId.of("Asia/Seoul"), "  안내  ");

            assertThat(values)
                    .doesNotContainKey("nickname")
                    .containsEntry("channel", "온라인·오프라인")
                    .containsEntry("notice", "안내")
                    .containsEntry("eventTitle", "연말 네트워킹 밋업");
        }

        @Test
        @DisplayName("취소 안내에는 행사명 · 안내 내용(· 닉네임)만 — 일정 · 장소 · 링크를 만들지 않는다")
        void cancellation() {
            ClubEvent event = EventMailFixtures.hybrid("https://meet.example.com/abc");

            assertThat(EventMailValues.cancellationFor(event, "취소합니다", "수현"))
                    .containsOnlyKeys("eventTitle", "notice", "nickname");
        }

        @Test
        @DisplayName("자동 메일 참여 안내는 참가 확정만 채우고 그 밖은 빈 문자열, 방식은 그 신청의 방식")
        void automatic() {
            ClubEvent event = EventMailFixtures.hybrid("https://meet.example.com/abc");
            ZoneId seoul = ZoneId.of("Asia/Seoul");

            assertThat(EventMailValues.automatic(event, EventChannel.ONLINE, seoul, "수현", true))
                    .containsEntry("participation", "https://meet.example.com/abc")
                    .containsEntry("channel", "온라인")
                    .containsEntry("nickname", "수현");
            assertThat(EventMailValues.automatic(event, EventChannel.ONLINE, seoul, "수현", false))
                    .containsEntry("participation", "");
        }
    }
}
