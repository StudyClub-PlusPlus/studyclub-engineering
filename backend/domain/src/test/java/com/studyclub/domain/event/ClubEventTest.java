package com.studyclub.domain.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.lang.reflect.Field;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ClubEventTest {

    private static final Instant START = Instant.parse("2026-12-05T10:00:00Z");
    private static final Instant END = Instant.parse("2026-12-05T13:00:00Z");
    private static final Instant DEADLINE = Instant.parse("2026-12-03T14:59:00Z");
    private static final Instant BEFORE_DEADLINE = DEADLINE.minus(Duration.ofHours(1));
    private static final Long CAPTAIN = 7L;

    // ── 픽스처 ─────────────────────────────────────────────────────────────

    /** 기본: 서울 · 하이브리드(온라인 100 · 오프라인 40) · 확정 방식 REVIEW · 질문 1개. */
    private static Draft draft() {
        return new Draft();
    }

    private static final class Draft {
        String title = "연말 네트워킹 밋업";
        String timeZone = "Asia/Seoul";
        Instant startsAt = START;
        Instant endsAt = END;
        Instant deadlineAt = DEADLINE;
        EventConfirmation confirmation = EventConfirmation.REVIEW;
        List<ChannelDraft> channels =
                new ArrayList<>(
                        List.of(
                                ChannelDraft.online(100, "https://meet.example.com/abc"),
                                ChannelDraft.offline(40, "서울 강남구 ○○빌딩 5층")));
        List<QuestionDraft> questions =
                new ArrayList<>(
                        List.of(
                                new QuestionDraft(
                                        null,
                                        "참여 동기",
                                        EventQuestionType.TEXTAREA,
                                        true,
                                        List.of())));

        Draft timeZone(String value) {
            timeZone = value;
            return this;
        }

        Draft startsAt(Instant value) {
            startsAt = value;
            return this;
        }

        Draft endsAt(Instant value) {
            endsAt = value;
            return this;
        }

        Draft deadlineAt(Instant value) {
            deadlineAt = value;
            return this;
        }

        Draft confirmation(EventConfirmation value) {
            confirmation = value;
            return this;
        }

        Draft channels(ChannelDraft... values) {
            channels = new ArrayList<>(List.of(values));
            return this;
        }

        Draft questions(QuestionDraft... values) {
            questions = new ArrayList<>(List.of(values));
            return this;
        }

        EventDraft build() {
            return new EventDraft(
                    title,
                    "한 해를 마무리하며 크루끼리 만나요",
                    "행사 소개",
                    timeZone,
                    startsAt,
                    endsAt,
                    deadlineAt,
                    confirmation,
                    channels,
                    questions);
        }

        ClubEvent publish() {
            return ClubEvent.publish(build(), CAPTAIN, "key", deadlineAt.minus(Duration.ofDays(1)));
        }
    }

    private static ClubEvent withStatus(ClubEvent event, EventStatus status) {
        set(event, "status", status);
        return event;
    }

    private static void set(Object target, String name, Object value) {
        try {
            Field field = ClubEvent.class.getDeclaredField(name);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static EventSeatCounts counts(
            int onlinePending, int onlineConfirmed, int offlinePending, int offlineConfirmed) {
        return new EventSeatCounts(
                onlinePending, onlineConfirmed, offlinePending, offlineConfirmed);
    }

    private static void assertCode(Runnable action, ErrorCode code) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(code);
    }

    private static void assertInvalid(Runnable action, String field) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .hasMessageStartingWith(field + ":")
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.INVALID_INPUT);
    }

    // ── 종료 판정 시각 ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("effectiveEndsAt — 종료 시각이 없으면 행사 시간대에서 시작일 다음 날 00:00")
    class EffectiveEndsAt {

        @Test
        @DisplayName("종료 시각을 입력했으면 그 시각이 언제나 우선한다")
        void usesEndsAt() {
            assertThat(draft().publish().effectiveEndsAt()).isEqualTo(END);
        }

        /**
         * 기대값은 손으로 셌다. 북미 세 곳의 2026 서머타임: 3월 8일 02:00 시작, 11월 1일 02:00 끝. 서울은 서머타임이 없다. 전환일은 하루가
         * 23·25 시간이라 「시작 + 24시간」으로 계산하면 한 시간씩 어긋난다.
         */
        @ParameterizedTest(name = "{0} 시작 {1} → {2}")
        @CsvSource({
            // 서울: 11/28 10:00 KST 시작 → 11/29 00:00 KST (스펙 예시)
            "Asia/Seoul, 2026-11-28T01:00:00Z, 2026-11-28T15:00:00Z",
            // 서울: 11/28 23:59 KST 시작 → 같은 자정
            "Asia/Seoul, 2026-11-28T14:59:00Z, 2026-11-28T15:00:00Z",
            // 서울: 11/29 00:00 KST 정각 시작은 11/29 의 행사 → 11/30 00:00 KST
            "Asia/Seoul, 2026-11-28T15:00:00Z, 2026-11-29T15:00:00Z",
            // 뉴욕: 3/7 20:00 EST 시작 → 3/8 00:00 EST (전환 전 자정)
            "America/New_York, 2026-03-08T01:00:00Z, 2026-03-08T05:00:00Z",
            // 뉴욕: 3/8(23시간인 날) 10:00 EDT 시작 → 3/9 00:00 EDT
            "America/New_York, 2026-03-08T14:00:00Z, 2026-03-09T04:00:00Z",
            // 뉴욕: 10/31 20:00 EDT 시작 → 11/1 00:00 EDT (전환 전 자정)
            "America/New_York, 2026-11-01T00:00:00Z, 2026-11-01T04:00:00Z",
            // 뉴욕: 11/1(25시간인 날) 10:00 EST 시작 → 11/2 00:00 EST
            "America/New_York, 2026-11-01T15:00:00Z, 2026-11-02T05:00:00Z",
            // 토론토: 뉴욕과 같은 규칙
            "America/Toronto, 2026-03-08T14:00:00Z, 2026-03-09T04:00:00Z",
            "America/Toronto, 2026-11-01T15:00:00Z, 2026-11-02T05:00:00Z",
            // LA: 3/7 20:00 PST 시작 → 3/8 00:00 PST
            "America/Los_Angeles, 2026-03-08T04:00:00Z, 2026-03-08T08:00:00Z",
            // LA: 3/8 10:00 PDT 시작 → 3/9 00:00 PDT
            "America/Los_Angeles, 2026-03-08T17:00:00Z, 2026-03-09T07:00:00Z",
            // LA: 11/1 10:00 PST 시작 → 11/2 00:00 PST
            "America/Los_Angeles, 2026-11-01T18:00:00Z, 2026-11-02T08:00:00Z",
            // LA: 10/31 23:30 PDT 시작 → 11/1 00:00 PDT
            "America/Los_Angeles, 2026-11-01T06:30:00Z, 2026-11-01T07:00:00Z"
        })
        void midnightOfNextLocalDay(String zone, Instant startsAt, Instant expected) {
            ClubEvent event =
                    draft().timeZone(zone)
                            .startsAt(startsAt)
                            .endsAt(null)
                            .deadlineAt(startsAt)
                            .publish();

            assertThat(event.effectiveEndsAt()).isEqualTo(expected);
        }
    }

    // ── 표시 상태 ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("displayStatus — 행사 취소 > 종료 > 모집 마감 > 정원 마감 > 모집 중")
    class DisplayStatus {

        @Test
        @DisplayName("취소한 행사는 종료 뒤에도 행사 취소다 — 가장 먼저 본다")
        void cancelledFirst() {
            ClubEvent event = withStatus(draft().publish(), EventStatus.CANCELLED);

            assertThat(event.displayStatus(END.plusSeconds(1), EventSeatCounts.none()))
                    .isEqualTo(EventDisplayStatus.CANCELLED);
            assertThat(event.displayStatus(BEFORE_DEADLINE, EventSeatCounts.none()))
                    .isEqualTo(EventDisplayStatus.CANCELLED);
        }

        @Test
        @DisplayName("종료 판정 시각 정각부터 종료다 — 수동 마감·정원 마감보다 먼저")
        void endedAtEffectiveEnd() {
            ClubEvent event = withStatus(draft().publish(), EventStatus.CLOSED);

            assertThat(event.displayStatus(END, counts(100, 0, 40, 0)))
                    .isEqualTo(EventDisplayStatus.ENDED);
            assertThat(event.displayStatus(END.minusSeconds(1), counts(100, 0, 40, 0)))
                    .isEqualTo(EventDisplayStatus.RECRUITMENT_CLOSED);
        }

        @Test
        @DisplayName("캡틴이 모집을 마감했으면 마감 전이라도 모집 마감이다 — 정원 마감보다 먼저")
        void closedByCaptain() {
            ClubEvent event = withStatus(draft().publish(), EventStatus.CLOSED);

            assertThat(event.displayStatus(BEFORE_DEADLINE, counts(0, 100, 0, 40)))
                    .isEqualTo(EventDisplayStatus.RECRUITMENT_CLOSED);
        }

        @Test
        @DisplayName("신청 마감 시각 정각부터 모집 마감이다")
        void closedAtDeadline() {
            ClubEvent event = draft().publish();

            assertThat(event.displayStatus(DEADLINE.minusSeconds(1), EventSeatCounts.none()))
                    .isEqualTo(EventDisplayStatus.RECRUITING);
            assertThat(event.displayStatus(DEADLINE, EventSeatCounts.none()))
                    .isEqualTo(EventDisplayStatus.RECRUITMENT_CLOSED);
        }

        @Test
        @DisplayName("시작 후 종료 전은 모집 마감이다 — 「진행 중」 표시는 없다")
        void startedButNotEnded() {
            ClubEvent event = draft().deadlineAt(START).publish();

            assertThat(event.displayStatus(START, EventSeatCounts.none()))
                    .isEqualTo(EventDisplayStatus.RECRUITMENT_CLOSED);
        }

        @Test
        @DisplayName("모든 방식의 잔여석이 0 이면 정원 마감, 한 방식이라도 남으면 모집 중")
        void fullOnlyWhenEveryChannelFull() {
            ClubEvent event = draft().publish();

            assertThat(event.displayStatus(BEFORE_DEADLINE, counts(3, 97, 5, 35)))
                    .isEqualTo(EventDisplayStatus.FULL);
            assertThat(event.displayStatus(BEFORE_DEADLINE, counts(3, 41, 5, 35)))
                    .isEqualTo(EventDisplayStatus.RECRUITING);
        }

        @Test
        @DisplayName("정원 마감은 저장하지 않는다 — 신청 취소로 자리가 나면 모집 중으로 돌아간다 (Q11)")
        void fullReturnsToRecruitingWhenSeatFrees() {
            ClubEvent event = draft().channels(ChannelDraft.offline(2, "강남")).publish();

            assertThat(event.displayStatus(BEFORE_DEADLINE, counts(0, 0, 1, 1)))
                    .isEqualTo(EventDisplayStatus.FULL);
            assertThat(event.displayStatus(BEFORE_DEADLINE, counts(0, 0, 0, 1)))
                    .isEqualTo(EventDisplayStatus.RECRUITING);
        }

        @Test
        @DisplayName("정원을 늘려 저장해도 모집 중으로 돌아간다")
        void fullReturnsToRecruitingWhenCapacityGrows() {
            ClubEvent event = draft().channels(ChannelDraft.offline(2, "강남")).publish();
            EventSeatCounts counts = counts(0, 0, 0, 2);

            event.edit(
                    draft().channels(ChannelDraft.offline(3, "강남")).build(),
                    0L,
                    BEFORE_DEADLINE,
                    counts);

            assertThat(event.displayStatus(BEFORE_DEADLINE, counts))
                    .isEqualTo(EventDisplayStatus.RECRUITING);
        }
    }

    // ── 잔여석 · 수정 가능 판정 ─────────────────────────────────────────────

    @Test
    @DisplayName("seatsOf — 잔여석 = 정원 − (확인 대기 + 참가 확정), 넘치면 0. 없는 방식은 빈 값")
    void seatsOf() {
        ClubEvent event = draft().publish();

        assertThat(event.seatsOf(EventChannel.ONLINE, counts(3, 41, 30, 20)))
                .contains(new ChannelSeats(EventChannel.ONLINE, 100, 3, 41, 56));
        assertThat(event.seatsOf(EventChannel.OFFLINE, counts(3, 41, 30, 20)))
                .contains(new ChannelSeats(EventChannel.OFFLINE, 40, 30, 20, 0));

        ClubEvent online = draft().channels(ChannelDraft.online(10, null)).publish();
        assertThat(online.seatsOf(EventChannel.OFFLINE, EventSeatCounts.none())).isEmpty();
    }

    @Test
    @DisplayName("seats — 입력 순서와 관계없이 ONLINE, OFFLINE 순 (§5)")
    void seatsOrder() {
        ClubEvent event =
                draft().channels(ChannelDraft.offline(40, "강남"), ChannelDraft.online(100, null))
                        .publish();

        assertThat(event.seats(EventSeatCounts.none()))
                .extracting(ChannelSeats::channel)
                .containsExactly(EventChannel.ONLINE, EventChannel.OFFLINE);
    }

    @Test
    @DisplayName("canEdit — 취소 아님 ∧ 종료 전. 시작 후에도 종료 전이면 고칠 수 있다 (Q9)")
    void canEdit() {
        ClubEvent event = draft().publish();

        assertThat(event.canEdit(START.plusSeconds(1))).isTrue();
        assertThat(event.canEdit(END.minusSeconds(1))).isTrue();
        assertThat(event.canEdit(END)).isFalse();
        assertThat(withStatus(event, EventStatus.CANCELLED).canEdit(BEFORE_DEADLINE)).isFalse();
    }

    @Test
    @DisplayName("canChangeConfirmation · canSetFutureStart — 시작 시각 정각부터 false, 취소·종료면 false")
    void beforeStartOnly() {
        ClubEvent event = draft().publish();

        assertThat(event.canChangeConfirmation(START.minusSeconds(1))).isTrue();
        assertThat(event.canSetFutureStart(START.minusSeconds(1))).isTrue();
        assertThat(event.canChangeConfirmation(START)).isFalse();
        assertThat(event.canSetFutureStart(START)).isFalse();

        withStatus(event, EventStatus.CANCELLED);
        assertThat(event.canChangeConfirmation(BEFORE_DEADLINE)).isFalse();
        assertThat(event.canSetFutureStart(BEFORE_DEADLINE)).isFalse();
    }

    @Test
    @DisplayName("removableChannels — 단일 방식은 빈 배열, 혼합은 확인 대기·참가 확정이 없는 방식만")
    void removableChannels() {
        ClubEvent hybrid = draft().publish();
        assertThat(hybrid.removableChannels(EventSeatCounts.none()))
                .containsExactly(EventChannel.ONLINE, EventChannel.OFFLINE);
        assertThat(hybrid.removableChannels(counts(0, 0, 1, 0)))
                .containsExactly(EventChannel.ONLINE);
        assertThat(hybrid.removableChannels(counts(0, 1, 0, 0)))
                .containsExactly(EventChannel.OFFLINE);
        assertThat(hybrid.removableChannels(counts(3, 41, 5, 35))).isEmpty();

        ClubEvent single = draft().channels(ChannelDraft.online(10, null)).publish();
        assertThat(single.removableChannels(EventSeatCounts.none())).isEmpty();
    }

    @Test
    @DisplayName("format — 저장된 참여 방식 행의 조합")
    void format() {
        assertThat(draft().publish().format()).isEqualTo(EventFormat.HYBRID);
        assertThat(draft().channels(ChannelDraft.online(1, null)).publish().format())
                .isEqualTo(EventFormat.ONLINE);
        assertThat(draft().channels(ChannelDraft.offline(1, "강남")).publish().format())
                .isEqualTo(EventFormat.OFFLINE);
    }

    // ── 등록 ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("등록하면 바로 공개 · 버전 0 · 공개 시각 = 등록 시각. 질문에는 새 키가 붙는다")
    void publish() {
        Instant now = BEFORE_DEADLINE;
        ClubEvent event = ClubEvent.publish(draft().build(), CAPTAIN, "key", now);

        assertThat(event.getStatus()).isEqualTo(EventStatus.PUBLISHED);
        assertThat(event.getVersion()).isZero();
        assertThat(event.getPublishedAt()).isEqualTo(now);
        assertThat(event.getCreatedBy()).isEqualTo(CAPTAIN);
        assertThat(event.getQuestions())
                .singleElement()
                .satisfies(q -> assertThat(q.getQuestionKey()).hasSize(36));
    }

    @Test
    @DisplayName("등록은 미래 마감이 필요하다 — 마감 정각이면 400 deadlineAt")
    void publishNeedsFutureDeadline() {
        assertInvalid(
                () -> ClubEvent.publish(draft().build(), CAPTAIN, "key", DEADLINE), "deadlineAt");
    }

    // ── 입력값 ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("EventDraft — 공백을 지우고 UTF-16 글자 수로 센다")
    class Inputs {

        @Test
        @DisplayName("앞뒤 공백은 지운 뒤 세고 저장한다 — 60자 + 공백은 통과")
        void trimsBeforeCounting() {
            Draft draft = draft();
            draft.title = "  " + "가".repeat(60) + "  ";

            assertThat(draft.build().title()).isEqualTo("가".repeat(60));
        }

        @Test
        @DisplayName("행사명 61자 · 공백뿐 · null 은 400 title")
        void titleLength() {
            Draft over = draft();
            over.title = "가".repeat(61);
            assertInvalid(over::build, "title");
            Draft blank = draft();
            blank.title = "   ";
            assertInvalid(blank::build, "title");
            Draft missing = draft();
            missing.title = null;
            assertInvalid(missing::build, "title");
        }

        @Test
        @DisplayName("이모지 하나는 UTF-16 두 글자다 — JS length 와 같은 기준")
        void countsUtf16() {
            Draft draft = draft();
            draft.title = "😀".repeat(30);
            assertThat(draft.build().title()).hasSize(60);
            draft.title = "😀".repeat(30) + "a";
            assertInvalid(draft::build, "title");
        }

        @Test
        @DisplayName("허용한 네 시간대 밖은 400 timeZone (밴쿠버 포함)")
        void timeZones() {
            for (String zone : EventLimits.TIME_ZONES) {
                assertThat(draft().timeZone(zone).build().timeZone()).isEqualTo(zone);
            }
            assertInvalid(() -> draft().timeZone("America/Vancouver").build(), "timeZone");
            assertInvalid(() -> draft().timeZone("UTC").build(), "timeZone");
        }

        @Test
        @DisplayName("종료는 시작 이후, 마감은 시작 이전이거나 같아야 한다")
        void timeOrder() {
            assertInvalid(() -> draft().endsAt(START).build(), "endsAt");
            assertInvalid(() -> draft().deadlineAt(START.plusSeconds(60)).build(), "deadlineAt");
            assertThat(draft().deadlineAt(START).build().deadlineAt()).isEqualTo(START);
        }

        @Test
        @DisplayName("시각은 분 단위로 맞춘다")
        void truncatesToMinute() {
            EventDraft draft = draft().startsAt(START.plusSeconds(59)).build();
            assertThat(draft.startsAt()).isEqualTo(START);
        }

        @Test
        @DisplayName("정원은 1 ~ 10,000")
        void capacity() {
            assertInvalid(
                    () -> draft().channels(ChannelDraft.online(0, null)).build(),
                    "online.capacity");
            assertInvalid(
                    () -> draft().channels(ChannelDraft.offline(10_001, "강남")).build(),
                    "offline.capacity");
            assertThat(draft().channels(ChannelDraft.online(10_000, null)).build().channels())
                    .hasSize(1);
        }

        @Test
        @DisplayName("오프라인 장소는 1~300자 필수")
        void location() {
            assertInvalid(
                    () -> draft().channels(ChannelDraft.offline(1, " ")).build(),
                    "offline.location");
            assertInvalid(
                    () -> draft().channels(ChannelDraft.offline(1, "가".repeat(301))).build(),
                    "offline.location");
        }

        @Test
        @DisplayName("참여 링크 — 빈 값은 null(추후 안내), http·https 절대 주소만, 2,048자까지")
        void onlineUrl() {
            String base = "https://meet.example.com/";
            assertThat(
                            draft().channels(ChannelDraft.online(1, "  "))
                                    .build()
                                    .channels()
                                    .get(0)
                                    .onlineUrl())
                    .isNull();
            assertThat(
                            draft().channels(ChannelDraft.online(1, "HTTP://meet.example.com"))
                                    .build()
                                    .channels()
                                    .get(0)
                                    .onlineUrl())
                    .isEqualTo("HTTP://meet.example.com");
            for (String bad :
                    List.of(
                            "ftp://example.com",
                            "javascript:alert(1)",
                            "/relative",
                            "meet.example.com",
                            base + "a".repeat(2_049 - base.length()))) {
                assertInvalid(
                        () -> draft().channels(ChannelDraft.online(1, bad)).build(), "online.url");
            }
            String longest = base + "a".repeat(2_048 - base.length());
            assertThat(longest).hasSize(2_048);
            assertThat(draft().channels(ChannelDraft.online(1, longest)).build().channels())
                    .hasSize(1);
        }

        @Test
        @DisplayName("실패 메시지에 참여 링크를 넣지 않는다 — 확정자만 보는 값이다")
        void urlNotInMessage() {
            assertThatThrownBy(
                            () ->
                                    draft().channels(ChannelDraft.online(1, "ftp://secret.example"))
                                            .build())
                    .hasMessageNotContaining("secret");
        }

        @Test
        @DisplayName("질문은 20개까지")
        void questionCount() {
            QuestionDraft q =
                    new QuestionDraft(null, "질문", EventQuestionType.TEXT, false, List.of());
            QuestionDraft[] twenty = new QuestionDraft[20];
            Arrays.fill(twenty, q);
            assertThat(draft().questions(twenty).build().questions()).hasSize(20);
            QuestionDraft[] over = new QuestionDraft[21];
            Arrays.fill(over, q);
            assertInvalid(() -> draft().questions(over).build(), "questions");
        }

        @Test
        @DisplayName("단답·장문은 선택지가 없어야 하고, 객관식은 공백 아닌 서로 다른 2~10개 · 각 100자")
        void options() {
            assertInvalid(
                    () -> draft().questions(question(EventQuestionType.TEXT, "A")).build(),
                    "questions[0].options");
            assertInvalid(
                    () -> draft().questions(question(EventQuestionType.RADIO, "A")).build(),
                    "questions[0].options");
            assertInvalid(
                    () ->
                            draft().questions(
                                            question(EventQuestionType.TEXT),
                                            question(EventQuestionType.CHECKBOX, "A", " A "))
                                    .build(),
                    "questions[1].options");
            assertInvalid(
                    () -> draft().questions(question(EventQuestionType.RADIO, "A", "  ")).build(),
                    "questions[0].options[1]");
            assertInvalid(
                    () ->
                            draft().questions(
                                            question(EventQuestionType.RADIO, "A", "가".repeat(101)))
                                    .build(),
                    "questions[0].options[1]");
            String[] eleven = new String[11];
            for (int i = 0; i < 11; i++) {
                eleven[i] = "선택" + i;
            }
            assertInvalid(
                    () -> draft().questions(question(EventQuestionType.CHECKBOX, eleven)).build(),
                    "questions[0].options");
            assertThat(
                            draft().questions(question(EventQuestionType.RADIO, " A ", "B"))
                                    .build()
                                    .questions()
                                    .get(0)
                                    .options())
                    .containsExactly("A", "B");
        }

        @Test
        @DisplayName("질문 제목은 1~200자")
        void label() {
            assertInvalid(
                    () ->
                            draft().questions(
                                            new QuestionDraft(
                                                    null,
                                                    "가".repeat(201),
                                                    EventQuestionType.TEXT,
                                                    false,
                                                    List.of()))
                                    .build(),
                    "questions[0].label");
        }

        private QuestionDraft question(EventQuestionType type, String... options) {
            return new QuestionDraft(null, "질문", type, false, List.of(options));
        }
    }

    // ── 수정: 처리 순서 ────────────────────────────────────────────────────

    @Nested
    @DisplayName("edit — 처리 순서 2~11 을 순서대로, 먼저 걸린 하나만")
    class Edit {

        /** 시작 1시간 후 · 종료 2시간 전 — 6·7 이 걸리는 시점. */
        private final Instant started = START.plus(Duration.ofHours(1));

        @Test
        @DisplayName("모든 조건을 어긴 요청을 하나씩 고치면 스펙 순서대로 다음 실패가 나온다")
        void failsInSpecOrder() {
            ClubEvent event = draft().publish();
            String key = event.getQuestions().get(0).getQuestionKey();
            EventSeatCounts counts = counts(3, 0, 5, 0);
            Instant now = started;

            Draft request =
                    draft().startsAt(now.plus(Duration.ofHours(1))) // 6
                            .endsAt(now.plus(Duration.ofHours(2)))
                            .deadlineAt(now.plus(Duration.ofMinutes(30)))
                            .confirmation(EventConfirmation.AUTO) // 7
                            .channels(ChannelDraft.online(2, null)) // 8 (오프라인 5명) · 9 (온라인 3명)
                            .questions(
                                    new QuestionDraft(
                                            "없는 키",
                                            "참여 동기",
                                            EventQuestionType.TEXT,
                                            false,
                                            List.of())); // 5

            // 2 — 취소가 종료·버전보다 먼저
            withStatus(event, EventStatus.CANCELLED);
            set(event, "endsAt", now.minusSeconds(60));
            assertCode(
                    () -> event.edit(request.build(), 99L, now, counts), ErrorCode.EVENT_CANCELLED);
            // 3 — 종료가 버전보다 먼저
            withStatus(event, EventStatus.PUBLISHED);
            assertCode(() -> event.edit(request.build(), 99L, now, counts), ErrorCode.EVENT_ENDED);
            // 4
            set(event, "endsAt", END);
            assertCode(
                    () -> event.edit(request.build(), 99L, now, counts),
                    ErrorCode.EVENT_VERSION_CONFLICT);
            // 5 — 400 인데 6~9 의 409 보다 먼저
            assertInvalid(
                    () -> event.edit(request.build(), 0L, now, counts), "questions[0].questionId");
            request.questions(
                    new QuestionDraft(key, "참여 동기", EventQuestionType.TEXT, false, List.of()));
            // 6
            assertCode(
                    () -> event.edit(request.build(), 0L, now, counts),
                    ErrorCode.EVENT_START_LOCKED);
            request.startsAt(START)
                    .deadlineAt(DEADLINE.minus(Duration.ofHours(1)))
                    .endsAt(now.minusSeconds(60));
            // 7
            assertCode(
                    () -> event.edit(request.build(), 0L, now, counts),
                    ErrorCode.EVENT_ALREADY_STARTED);
            request.confirmation(EventConfirmation.REVIEW);
            // 8
            assertCode(
                    () -> event.edit(request.build(), 0L, now, counts), ErrorCode.CHANNEL_IN_USE);
            request.channels(ChannelDraft.online(2, null), ChannelDraft.offline(40, "강남"));
            // 9
            assertCode(
                    () -> event.edit(request.build(), 0L, now, counts),
                    ErrorCode.CAPACITY_BELOW_OCCUPIED);
            request.channels(ChannelDraft.online(3, null), ChannelDraft.offline(5, "강남"));
            // 10 — 공개 중이고 마감을 지난 시각으로 옮겼다
            assertInvalid(() -> event.edit(request.build(), 0L, now, counts), "deadlineAt");
            request.deadlineAt(DEADLINE);
            // 11 — 저장 즉시 종료
            assertInvalid(() -> event.edit(request.build(), 0L, now, counts), "endsAt");
            request.endsAt(END.plus(Duration.ofHours(1)));

            boolean switched = event.edit(request.build(), 0L, now, counts);

            assertThat(switched).isFalse();
            assertThat(event.getVersion()).isEqualTo(1L);
            assertThat(event.getEndsAt()).isEqualTo(END.plus(Duration.ofHours(1)));
            assertThat(event.getQuestions())
                    .singleElement()
                    .satisfies(
                            q -> {
                                assertThat(q.getQuestionKey()).isEqualTo(key);
                                assertThat(q.getType()).isEqualTo(EventQuestionType.TEXT);
                            });
        }

        @Test
        @DisplayName("실패하면 아무것도 바꾸지 않는다 — 버전도 그대로")
        void failureChangesNothing() {
            ClubEvent event = draft().publish();

            assertCode(
                    () ->
                            event.edit(
                                    draft().channels(ChannelDraft.online(1, null)).build(),
                                    0L,
                                    BEFORE_DEADLINE,
                                    counts(0, 0, 1, 0)),
                    ErrorCode.CHANNEL_IN_USE);

            assertThat(event.getVersion()).isZero();
            assertThat(event.format()).isEqualTo(EventFormat.HYBRID);
        }

        @Test
        @DisplayName("같은 질문 키를 두 번 보내면 400 — 두 번째 위치를 가리킨다")
        void duplicateQuestionKey() {
            ClubEvent event = draft().publish();
            String key = event.getQuestions().get(0).getQuestionKey();
            QuestionDraft same =
                    new QuestionDraft(key, "참여 동기", EventQuestionType.TEXT, false, List.of());

            assertInvalid(
                    () ->
                            event.edit(
                                    draft().questions(same, same).build(),
                                    0L,
                                    BEFORE_DEADLINE,
                                    EventSeatCounts.none()),
                    "questions[1].questionId");
        }

        @Test
        @DisplayName("시작 후에도 시작 시각을 과거 안에서 옮기는 것은 된다 (6 은 미래로 옮길 때만)")
        void startedMayMoveStartWithinPast() {
            ClubEvent event = draft().publish();
            Instant earlier = START.minus(Duration.ofMinutes(30));

            event.edit(draft().startsAt(earlier).build(), 0L, started, EventSeatCounts.none());

            assertThat(event.getStartsAt()).isEqualTo(earlier);
        }

        @Test
        @DisplayName("시작 전이라도 새 시작 시각이 지금 이전이면 확정 방식을 못 바꾼다 (7 의 두 번째 조건)")
        void confirmationLockedByNewStart() {
            ClubEvent event = draft().publish();
            Instant now = BEFORE_DEADLINE;
            Instant past = now.minus(Duration.ofMinutes(10));

            assertCode(
                    () ->
                            event.edit(
                                    draft().startsAt(past)
                                            .deadlineAt(past)
                                            .confirmation(EventConfirmation.AUTO)
                                            .build(),
                                    0L,
                                    now,
                                    EventSeatCounts.none()),
                    ErrorCode.EVENT_ALREADY_STARTED);
        }

        @Test
        @DisplayName("마감을 바꾸지 않았으면 지난 마감도 그대로 둔다. 모집 마감(CLOSED) 행사는 지난 마감으로 옮겨도 된다")
        void deadlineRule() {
            Instant now = DEADLINE.plus(Duration.ofHours(1));
            ClubEvent unchanged = draft().publish();
            unchanged.edit(draft().build(), 0L, now, EventSeatCounts.none());
            assertThat(unchanged.getDeadlineAt()).isEqualTo(DEADLINE);

            ClubEvent closed = withStatus(draft().publish(), EventStatus.CLOSED);
            Instant earlier = DEADLINE.minus(Duration.ofHours(2));
            closed.edit(draft().deadlineAt(earlier).build(), 0L, now, EventSeatCounts.none());
            assertThat(closed.getDeadlineAt()).isEqualTo(earlier);
        }

        @Test
        @DisplayName("종료 시각을 비웠는데 기본 종료 시각(시작일 다음 날 00:00)이 이미 지났으면 400 endsAt")
        void clearingEndsAtThatWouldEndNow() {
            // 서울 12/5 19:00 시작, 종료 12/6 18:00 — 12/6 01:00 KST 에 종료를 비우면 기본 종료(12/6 00:00 KST)가 지났다
            Instant start = Instant.parse("2026-12-05T10:00:00Z");
            ClubEvent event = draft().endsAt(Instant.parse("2026-12-06T09:00:00Z")).publish();
            Instant now = Instant.parse("2026-12-05T16:00:00Z");

            assertInvalid(
                    () ->
                            event.edit(
                                    draft().startsAt(start).endsAt(null).build(),
                                    0L,
                                    now,
                                    EventSeatCounts.none()),
                    "endsAt");
        }

        @Test
        @DisplayName("REVIEW → AUTO 일 때만 true — 호출자가 확인 대기를 일괄 확정한다")
        void switchToAuto() {
            ClubEvent review = draft().publish();
            assertThat(
                            review.edit(
                                    draft().confirmation(EventConfirmation.AUTO).build(),
                                    0L,
                                    BEFORE_DEADLINE,
                                    EventSeatCounts.none()))
                    .isTrue();
            assertThat(
                            review.edit(
                                    draft().confirmation(EventConfirmation.REVIEW).build(),
                                    1L,
                                    BEFORE_DEADLINE,
                                    EventSeatCounts.none()))
                    .isFalse();
            assertThat(
                            review.edit(
                                    draft().confirmation(EventConfirmation.REVIEW).build(),
                                    2L,
                                    BEFORE_DEADLINE,
                                    EventSeatCounts.none()))
                    .isFalse();
            assertThat(review.getVersion()).isEqualTo(3L);
        }

        @Test
        @DisplayName("질문 전체 교체 — 키를 보낸 질문은 키 유지, 빠진 질문은 삭제, 새 질문은 새 키, 배열 순서가 표시 순서")
        void replacesQuestions() {
            ClubEvent event =
                    draft().questions(
                                    new QuestionDraft(
                                            null, "A", EventQuestionType.TEXT, false, List.of()),
                                    new QuestionDraft(
                                            null, "B", EventQuestionType.TEXT, false, List.of()))
                            .publish();
            String keyA = event.getQuestions().get(0).getQuestionKey();

            event.edit(
                    draft().questions(
                                    new QuestionDraft(
                                            null,
                                            "C",
                                            EventQuestionType.RADIO,
                                            true,
                                            List.of("x", "y")),
                                    new QuestionDraft(
                                            keyA,
                                            "A2",
                                            EventQuestionType.TEXTAREA,
                                            true,
                                            List.of()))
                            .build(),
                    0L,
                    BEFORE_DEADLINE,
                    EventSeatCounts.none());

            List<ClubEventQuestion> questions = event.getQuestions();
            assertThat(questions)
                    .extracting(ClubEventQuestion::getLabel)
                    .containsExactly("C", "A2");
            assertThat(questions.get(1).getQuestionKey()).isEqualTo(keyA);
            assertThat(questions.get(0).getQuestionKey()).isNotEqualTo(keyA).hasSize(36);
            assertThat(questions.get(0).getOptions()).containsExactly("x", "y");
        }

        @Test
        @DisplayName("참여 방식 교체 — 신청이 없으면 ONLINE → OFFLINE 도 된다")
        void replacesChannels() {
            ClubEvent event =
                    draft().channels(ChannelDraft.online(10, "https://a.example")).publish();

            event.edit(
                    draft().channels(ChannelDraft.offline(5, "강남")).build(),
                    0L,
                    BEFORE_DEADLINE,
                    EventSeatCounts.none());

            assertThat(event.format()).isEqualTo(EventFormat.OFFLINE);
            assertThat(event.findChannel(EventChannel.OFFLINE))
                    .hasValueSatisfying(c -> assertThat(c.getCapacity()).isEqualTo(5));
        }

        @Test
        @DisplayName("정원은 유효 신청 수와 같으면 된다 — 9 는 「작게」만 막는다")
        void capacityEqualToOccupied() {
            ClubEvent event = draft().publish();

            event.edit(
                    draft().channels(ChannelDraft.online(44, null), ChannelDraft.offline(40, "강남"))
                            .build(),
                    0L,
                    BEFORE_DEADLINE,
                    counts(3, 41, 5, 35));

            assertThat(event.findChannel(EventChannel.ONLINE))
                    .hasValueSatisfying(c -> assertThat(c.getCapacity()).isEqualTo(44));
        }
    }
}
