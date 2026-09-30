package com.studyclub.api.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.study.StudyMeeting;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AttendanceRateCalculatorTest {

    private static final Instant NOW = Instant.parse("2026-09-19T12:00:00Z");
    private static final Instant JOINED_AT = Instant.parse("2026-09-01T00:00:00Z");

    // -------------------------------------------------------------------------
    // Group A — components()
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("components() 브랜치 검증")
    class ComponentsTest {

        @Test
        @DisplayName("참가자_상태_WITHDRAWN_이면_분모0_율null")
        void 참가자_상태_WITHDRAWN_이면_분모0_율null() {
            var participant = participant(ParticipantStatus.WITHDRAWN);

            double[] result =
                    AttendanceRateCalculator.components(participant, List.of(), Map.of(), NOW);

            assertThat(result[0]).isZero();
            assertThat(result[1]).isZero();
        }

        @Test
        @DisplayName("참가자_상태_COMPLETED_도_출석률_계산_대상이다")
        void 참가자_상태_COMPLETED_도_출석률_계산_대상이다() {
            var participant = participant(ParticipantStatus.COMPLETED);
            var meeting = pastMeeting(1L);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(meeting), Map.of(), NOW);

            assertThat(result[1]).isEqualTo(1);
        }

        @Test
        @DisplayName("참가자_상태_ACTIVE_이면_지난_미팅을_분모에_포함한다")
        void 참가자_상태_ACTIVE_이면_지난_미팅을_분모에_포함한다() {
            var participant = participant(ParticipantStatus.ACTIVE);
            var meeting = pastMeeting(1L);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(meeting), Map.of(), NOW);

            assertThat(result[1]).isEqualTo(1);
        }

        @Test
        @DisplayName("참가자_상태_PAUSED_도_출석률_계산_대상이다")
        void 참가자_상태_PAUSED_도_출석률_계산_대상이다() {
            var participant = participant(ParticipantStatus.PAUSED);
            var meeting = pastMeeting(1L);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(meeting), Map.of(), NOW);

            assertThat(result[1]).isEqualTo(1);
        }

        @Test
        @DisplayName("미래_미팅은_분모에_포함되지_않는다")
        void 미래_미팅은_분모에_포함되지_않는다() {
            var participant = participant(ParticipantStatus.ACTIVE);
            StudyMeeting futureMeeting = mock(StudyMeeting.class);
            when(futureMeeting.getScheduledAt()).thenReturn(NOW.plusSeconds(3600));

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(futureMeeting), Map.of(), NOW);

            assertThat(result[1]).isZero();
        }

        @Test
        @DisplayName("합류일_이전_미팅은_분모에_포함되지_않는다")
        void 합류일_이전_미팅은_분모에_포함되지_않는다() {
            var participant = participant(ParticipantStatus.ACTIVE);
            StudyMeeting beforeJoin = mock(StudyMeeting.class);
            when(beforeJoin.getScheduledAt()).thenReturn(JOINED_AT.minusSeconds(1));

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(beforeJoin), Map.of(), NOW);

            assertThat(result[1]).isZero();
        }

        @Test
        @DisplayName("합류일과_정확히_같은_미팅은_포함된다")
        void 합류일과_정확히_같은_미팅은_포함된다() {
            var participant = participant(ParticipantStatus.ACTIVE);
            StudyMeeting exactJoin = mock(StudyMeeting.class);
            when(exactJoin.getScheduledAt()).thenReturn(JOINED_AT);
            when(exactJoin.getId()).thenReturn(99L);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(exactJoin), Map.of(), NOW);

            assertThat(result[1]).isEqualTo(1);
        }

        @Test
        @DisplayName("현재_시각과_정확히_같은_미팅은_포함된다")
        void 현재_시각과_정확히_같은_미팅은_포함된다() {
            var participant = participant(ParticipantStatus.ACTIVE);
            StudyMeeting exactNow = mock(StudyMeeting.class);
            when(exactNow.getScheduledAt()).thenReturn(NOW);
            when(exactNow.getId()).thenReturn(99L);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(exactNow), Map.of(), NOW);

            assertThat(result[1]).isEqualTo(1);
        }

        @Test
        @DisplayName("PRESENT_출석은_분자에_1점_추가된다")
        void PRESENT_출석은_분자에_1점_추가된다() {
            var participant = participant(ParticipantStatus.ACTIVE);
            var meeting = pastMeeting(1L);
            var att = attendance(AttendanceStatus.PRESENT);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(meeting), Map.of(1L, att), NOW);

            assertThat(result[0]).isEqualTo(1.0);
            assertThat(result[1]).isEqualTo(1);
        }

        @Test
        @DisplayName("LATE_출석은_분자에_0점5_추가된다")
        void LATE_출석은_분자에_0점5_추가된다() {
            var participant = participant(ParticipantStatus.ACTIVE);
            var meeting = pastMeeting(1L);
            var att = attendance(AttendanceStatus.LATE);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(meeting), Map.of(1L, att), NOW);

            assertThat(result[0]).isEqualTo(AttendanceRateCalculator.LATE_WEIGHT);
            assertThat(result[1]).isEqualTo(1);
        }

        @Test
        @DisplayName("ABSENT_출석은_분자에_0점_분모는_1_추가된다")
        void ABSENT_출석은_분자에_0점_분모는_1_추가된다() {
            var participant = participant(ParticipantStatus.ACTIVE);
            var meeting = pastMeeting(1L);
            var att = attendance(AttendanceStatus.ABSENT);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(meeting), Map.of(1L, att), NOW);

            assertThat(result[0]).isZero();
            assertThat(result[1]).isEqualTo(1);
        }

        @Test
        @DisplayName("출석_기록이_없으면_ABSENT와_동일하게_분모만_오른다")
        void 출석_기록이_없으면_ABSENT와_동일하게_분모만_오른다() {
            var participant = participant(ParticipantStatus.ACTIVE);
            var meeting = pastMeeting(1L);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(meeting), Map.of(), NOW);

            assertThat(result[0]).isZero();
            assertThat(result[1]).isEqualTo(1);
        }

        @Test
        @DisplayName("EXCUSED_출석은_분자와_분모_모두_제외된다")
        void EXCUSED_출석은_분자와_분모_모두_제외된다() {
            var participant = participant(ParticipantStatus.ACTIVE);
            var meeting = pastMeeting(1L);
            var att = attendance(AttendanceStatus.EXCUSED);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant, List.of(meeting), Map.of(1L, att), NOW);

            assertThat(result[0]).isZero();
            assertThat(result[1]).isZero();
        }

        @Test
        @DisplayName("미팅_없으면_분모0_율null")
        void 미팅_없으면_분모0_율null() {
            var participant = participant(ParticipantStatus.ACTIVE);

            double[] result =
                    AttendanceRateCalculator.components(participant, List.of(), Map.of(), NOW);

            assertThat(result[0]).isZero();
            assertThat(result[1]).isZero();
        }

        @Test
        @DisplayName("모든_미팅이_EXCUSED이면_분모0_율null")
        void 모든_미팅이_EXCUSED이면_분모0_율null() {
            var participant = participant(ParticipantStatus.ACTIVE);
            var m1 = pastMeeting(1L);
            var m2 = pastMeeting(2L);

            double[] result =
                    AttendanceRateCalculator.components(
                            participant,
                            List.of(m1, m2),
                            Map.of(
                                    1L, attendance(AttendanceStatus.EXCUSED),
                                    2L, attendance(AttendanceStatus.EXCUSED)),
                            NOW);

            assertThat(result[0]).isZero();
            assertThat(result[1]).isZero();
        }

        @Test
        @DisplayName("혼합_케이스_PRESENT_LATE_ABSENT_율계산_검증")
        void 혼합_케이스_PRESENT_LATE_ABSENT_율계산_검증() {
            // given
            var participant = participant(ParticipantStatus.ACTIVE);
            var m1 = pastMeeting(1L);
            var m2 = pastMeeting(2L);
            var m3 = pastMeeting(3L);

            // when: PRESENT(1.0) + LATE(0.5) + ABSENT(0.0) / 3
            double[] result =
                    AttendanceRateCalculator.components(
                            participant,
                            List.of(m1, m2, m3),
                            Map.of(
                                    1L, attendance(AttendanceStatus.PRESENT),
                                    2L, attendance(AttendanceStatus.LATE),
                                    3L, attendance(AttendanceStatus.ABSENT)),
                            NOW);

            assertThat(result[0]).isEqualTo(1.5);
            assertThat(result[1]).isEqualTo(3);
        }

        @Test
        @DisplayName("합류_이전_미팅은_제외하고_이후만_계산된다")
        void 합류_이전_미팅은_제외하고_이후만_계산된다() {
            // given
            var participant = participant(ParticipantStatus.ACTIVE); // joinedAt = JOINED_AT
            // m1 is one second before joinedAt → excluded
            StudyMeeting m1 = mock(StudyMeeting.class);
            when(m1.getScheduledAt()).thenReturn(JOINED_AT.minusSeconds(1));

            var m2 = pastMeeting(2L); // after joinedAt, PRESENT
            var m3 = pastMeeting(3L); // after joinedAt, ABSENT

            // when
            double[] result =
                    AttendanceRateCalculator.components(
                            participant,
                            List.of(m1, m2, m3),
                            Map.of(
                                    2L, attendance(AttendanceStatus.PRESENT),
                                    3L, attendance(AttendanceStatus.ABSENT)),
                            NOW);

            // then: only m2 and m3 count → numerator=1.0, denominator=2
            assertThat(result[0]).isEqualTo(1.0);
            assertThat(result[1]).isEqualTo(2);
        }
    }

    // -------------------------------------------------------------------------
    // Group B — rate()
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("rate() 메서드 검증")
    class RateTest {

        @Test
        @DisplayName("rate_분모0이면_null_반환")
        void rate_분모0이면_null_반환() {
            assertThat(AttendanceRateCalculator.rate(new double[] {0, 0})).isNull();
        }

        @Test
        @DisplayName("rate_분모_양수이면_분자_나누기_분모")
        void rate_분모_양수이면_분자_나누기_분모() {
            assertThat(AttendanceRateCalculator.rate(new double[] {1.5, 2})).isEqualTo(0.75);
        }

        @Test
        @DisplayName("rate_완전_출석이면_1점0")
        void rate_완전_출석이면_1점0() {
            assertThat(AttendanceRateCalculator.rate(new double[] {3.0, 3})).isEqualTo(1.0);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private StudyParticipant participant(ParticipantStatus status) {
        return StudyParticipant.builder()
                .accountId(1L)
                .studyGroupId(1L)
                .studyId(1L)
                .status(status)
                .participantRole(ParticipantRole.MEMBER)
                .joinedAt(JOINED_AT)
                .build();
    }

    /** scheduledAt = NOW - 1h (항상 과거, 합류일 이후) */
    private StudyMeeting pastMeeting(Long id) {
        StudyMeeting meeting = mock(StudyMeeting.class);
        when(meeting.getId()).thenReturn(id);
        when(meeting.getScheduledAt()).thenReturn(NOW.minusSeconds(3600));
        return meeting;
    }

    private StudyAttendance attendance(AttendanceStatus status) {
        return StudyAttendance.builder()
                .accountId(1L)
                .studyId(1L)
                .studyGroupId(1L)
                .studyMeetingId(1L)
                .status(status)
                .build();
    }
}
