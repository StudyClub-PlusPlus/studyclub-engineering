package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyTest {

    @Test
    @DisplayName("모집 중 + 마감 2일 후 → 종료 임박")
    void closingSoon_openAndDeadlineWithin3Days() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.isClosingSoon(Instant.now().plus(2, ChronoUnit.DAYS))).isTrue();
    }

    @Test
    @DisplayName("모집 중 + 마감 30일 후 → 종료 임박 아님")
    void notClosingSoon_openButDeadlineFarAway() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.isClosingSoon(Instant.now().plus(30, ChronoUnit.DAYS))).isFalse();
    }

    @Test
    @DisplayName("마감됨 + 마감일 가까움 → 종료 임박 아님 (OPEN 이 아니므로)")
    void notClosingSoon_closedStatus() {
        var study = getStudy(StudyStatus.CLOSED);
        assertThat(study.isClosingSoon(Instant.now().plus(1, ChronoUnit.DAYS))).isFalse();
    }

    @Test
    @DisplayName("모집 예정 + 마감일 가까움 → 종료 임박 아님 (OPEN 이 아니므로)")
    void notClosingSoon_draftStatus() {
        var study = getStudy(StudyStatus.DRAFT);
        assertThat(study.isClosingSoon(Instant.now().plus(1, ChronoUnit.DAYS))).isFalse();
    }

    @Test
    @DisplayName("모집 중 + 마감일 null → 종료 임박 아님")
    void notClosingSoon_nullDeadline() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.isClosingSoon(null)).isFalse();
    }

    @Test
    @DisplayName("모집 중 + 마감 전 + 정원 미달 → RECRUITING")
    void recruiting_beforeDeadlineAndUnderCapacity() {
        var study = getStudy(StudyStatus.OPEN, 30);
        assertThat(study.recruitStatus(29, Instant.now().plus(7, ChronoUnit.DAYS), 30))
                .isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감 시각이 정확히 지금 → RECRUIT_CLOSED (경계는 마감 쪽)")
    void recruitClosed_deadlineExactlyNow() {
        var study = getStudy(StudyStatus.OPEN, 30);
        assertThat(study.recruitStatus(0, Instant.now(), 30))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("고정 asOf: 마감 시각과 같으면 RECRUIT_CLOSED, 1초 전이면 RECRUITING")
    void recruitStatus_fixedAsOf_makesDeadlineBoundaryDeterministic() {
        var study = getStudy(StudyStatus.OPEN, 30);
        var deadline = Instant.parse("2026-06-15T12:00:00Z");

        assertThat(study.recruitStatus(0, deadline, 30, deadline))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);
        assertThat(study.recruitStatus(0, deadline, 30, deadline.minusSeconds(1)))
                .isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("고정 asOf: 마감 2일 후면 종료 임박, asOf가 마감 직후면 아님")
    void isClosingSoon_fixedAsOf_makesWindowDeterministic() {
        var study = getStudy(StudyStatus.OPEN);
        var asOf = Instant.parse("2026-06-01T00:00:00Z");
        var deadline = asOf.plus(2, ChronoUnit.DAYS);

        assertThat(study.isClosingSoon(deadline, asOf)).isTrue();
        assertThat(study.isClosingSoon(deadline, deadline)).isFalse();
    }

    @Test
    @DisplayName("마감 1초 전 → RECRUITING")
    void recruiting_oneSecondBeforeDeadline() {
        var study = getStudy(StudyStatus.OPEN, 30);
        assertThat(study.recruitStatus(0, Instant.now().plusSeconds(1), 30))
                .isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감 시각 경과 → RECRUIT_CLOSED")
    void recruitClosed_deadlinePassed() {
        var study = getStudy(StudyStatus.OPEN, 30);
        assertThat(study.recruitStatus(0, Instant.now().minusSeconds(1), 30))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("신청자 수 = 정원 → RECRUIT_CLOSED (정원 도달)")
    void recruitClosed_capacityReached() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(30, Instant.now().plus(30, ChronoUnit.DAYS), 30))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("정원 초과 → RECRUIT_CLOSED")
    void recruitClosed_overCapacity() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(31, Instant.now().plus(30, ChronoUnit.DAYS), 30))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("정원 null (무제한) + 신청자 많음 → RECRUITING")
    void recruiting_nullCapacityNeverFills() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(9999, Instant.now().plus(30, ChronoUnit.DAYS), null))
                .isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감일 null (상시 모집) + 정원 미달 → RECRUITING")
    void recruiting_nullDeadlineNeverExpires() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(1, null, 30)).isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감일 null (상시 모집) + 정원 도달 → RECRUIT_CLOSED")
    void recruitClosed_nullDeadlineButCapacityReached() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(30, null, 30)).isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("DRAFT → 모집 상태 없음 (null). OPEN 일 때만 의미 있다")
    void noRecruitStatus_draft() {
        var study = getStudy(StudyStatus.DRAFT);
        assertThat(study.recruitStatus(0, Instant.now().plus(7, ChronoUnit.DAYS), 30)).isNull();
    }

    @Test
    @DisplayName("CLOSED → 모집 상태 없음 (null). 마감이 아니라 '없음'이다")
    void noRecruitStatus_closed() {
        var study = getStudy(StudyStatus.CLOSED);
        assertThat(study.recruitStatus(0, Instant.now().plus(7, ChronoUnit.DAYS), 30)).isNull();
    }

    @Test
    @DisplayName("단계: DRAFT → 없음 (공개 목록 대상이 아니다)")
    void phase_draftIsNull() {
        var study = getStudy(StudyStatus.DRAFT);
        assertThat(study.phase(0, null, 30)).isNull();
    }

    @Test
    @DisplayName("단계: 시작 전 + 모집 중 → RECRUITING")
    void phase_recruiting() {
        var study = phased(StudyStatus.OPEN, days(10), null);
        assertThat(study.phase(0, days(3), 30)).isEqualTo(StudyPhase.RECRUITING);
    }

    @Test
    @DisplayName("단계: 시작 전인데 모집 마감 → CLOSED (신청할 수 없다)")
    void phase_recruitClosedBeforeStart() {
        var study = phased(StudyStatus.OPEN, days(10), null);
        assertThat(study.phase(0, days(-1), 30)).isEqualTo(StudyPhase.CLOSED);
    }

    @Test
    @DisplayName("단계: 시작 후 종료 전 → ONGOING (모집 마감 여부와 무관)")
    void phase_ongoing() {
        var study = phased(StudyStatus.OPEN, days(-1), days(30));
        assertThat(study.phase(0, days(-5), 30)).isEqualTo(StudyPhase.ONGOING);
    }

    @Test
    @DisplayName("단계: 종료 시각 경과 → CLOSED (운영자가 아직 닫지 않아도)")
    void phase_endedByDate() {
        var study = phased(StudyStatus.OPEN, days(-30), days(-1));
        assertThat(study.phase(0, null, 30)).isEqualTo(StudyPhase.CLOSED);
    }

    @Test
    @DisplayName("단계: 운영자 종료 → CLOSED")
    void phase_closedByOperator() {
        var study = phased(StudyStatus.CLOSED, days(10), null);
        assertThat(study.phase(0, days(3), 30)).isEqualTo(StudyPhase.CLOSED);
    }

    @Test
    @DisplayName("단계: 운영자 종료 상태값 ENDED → CLOSED")
    void phase_endedStatus() {
        var study = phased(StudyStatus.ENDED, days(10), null);
        assertThat(study.phase(0, days(3), 30)).isEqualTo(StudyPhase.CLOSED);
    }

    @Test
    @DisplayName("지금 상태: 저장값이 OPEN 이어도 START_AT 이 지나면 ONGOING, END_AT 이 지나면 ENDED (bug-37)")
    void statusAsOf_readsDates() {
        Instant now = Instant.now();
        assertThat(phased(StudyStatus.OPEN, days(3), days(30)).statusAsOf(now))
                .isEqualTo(StudyStatus.OPEN);
        assertThat(phased(StudyStatus.OPEN, days(-1), days(30)).statusAsOf(now))
                .isEqualTo(StudyStatus.ONGOING);
        assertThat(phased(StudyStatus.OPEN, days(-1), null).statusAsOf(now))
                .isEqualTo(StudyStatus.ONGOING);
        assertThat(phased(StudyStatus.OPEN, days(-30), days(-1)).statusAsOf(now))
                .isEqualTo(StudyStatus.ENDED);
        assertThat(phased(StudyStatus.OPEN, null, null).statusAsOf(now))
                .isEqualTo(StudyStatus.OPEN);
        // 경계 — 정확히 그 시각이면 지난 것으로 본다
        assertThat(phased(StudyStatus.OPEN, now, null).statusAsOf(now))
                .isEqualTo(StudyStatus.ONGOING);
        assertThat(phased(StudyStatus.OPEN, days(-1), now).statusAsOf(now))
                .isEqualTo(StudyStatus.ENDED);
        assertThat(phased(StudyStatus.DRAFT, days(-30), days(-1)).statusAsOf(now))
                .isEqualTo(StudyStatus.DRAFT);
        assertThat(phased(StudyStatus.CLOSED, days(-1), days(30)).statusAsOf(now))
                .isEqualTo(StudyStatus.CLOSED);
    }

    @Test
    @DisplayName("끝났다: ENDED · CLOSED 이거나 END_AT 경과. 진행 중: 시작했고 안 끝났다")
    void isEnded_isOngoing() {
        Instant now = Instant.now();
        var started = phased(StudyStatus.OPEN, days(-1), days(30));
        var pastEnd = phased(StudyStatus.OPEN, days(-30), days(-1));
        var notStarted = phased(StudyStatus.OPEN, days(3), days(30));
        assertThat(started.isEnded(now)).isFalse();
        assertThat(started.isOngoing(now)).isTrue();
        assertThat(pastEnd.isEnded(now)).isTrue();
        assertThat(pastEnd.isOngoing(now)).isFalse();
        assertThat(notStarted.isEnded(now)).isFalse();
        assertThat(notStarted.isOngoing(now)).isFalse();
        assertThat(phased(StudyStatus.CLOSED, days(3), null).isEnded(now)).isTrue();
        assertThat(phased(StudyStatus.ENDED, null, null).isEnded(now)).isTrue();
    }

    @Test
    @DisplayName("신청 가능: 마감 1ms 전까지만, 같은 순간부터는 불가 — 조회 시간대와 무관하게 UTC 순간 하나로 판정")
    void canApply_deadlineInstant() {
        var study = getStudy(StudyStatus.OPEN);
        Instant deadline = Instant.parse("2026-09-16T14:59:59Z");

        assertThat(study.canApply(0, deadline, null, deadline.minusMillis(1))).isTrue();
        assertThat(study.canApply(0, deadline, null, deadline)).isFalse();
        assertThat(study.canApply(0, deadline, null, deadline.plusMillis(1))).isFalse();
    }

    @Test
    @DisplayName("신청 가능: 정원이 차거나 OPEN 이 아니면 불가, 마감 없음은 가능")
    void canApply_capacityAndStatus() {
        Instant now = Instant.parse("2026-09-01T00:00:00Z");
        Instant deadline = now.plusSeconds(3600);

        assertThat(getStudy(StudyStatus.OPEN).canApply(2, deadline, 2, now)).isFalse();
        assertThat(getStudy(StudyStatus.OPEN).canApply(1, deadline, 2, now)).isTrue();
        assertThat(getStudy(StudyStatus.OPEN).canApply(0, null, null, now)).isTrue();
        assertThat(getStudy(StudyStatus.DRAFT).canApply(0, deadline, null, now)).isFalse();
    }

    @Test
    @DisplayName("주소: 빈 문자열·공백은 null 로 저장하고, 앞뒤 공백은 자른다")
    void changeLinks_blankBecomesNull() {
        var study = getStudy(StudyStatus.OPEN);

        study.changeDiscordChannelUrl("  https://discord.com/channels/1/2 ");
        study.changeDriveUrl("   ");

        assertThat(study.getDiscordChannelUrl()).isEqualTo("https://discord.com/channels/1/2");
        assertThat(study.getDriveUrl()).isNull();
    }

    private static Instant days(long days) {
        return Instant.now().plus(days, ChronoUnit.DAYS);
    }

    @Test
    @DisplayName("비공개 전환: 시작 전 OPEN 은 DRAFT 가 된다")
    void unpublish_beforeStart() {
        var study = phased(StudyStatus.OPEN, days(3), days(30));
        study.unpublish(Instant.now());
        assertThat(study.getStatus()).isEqualTo(StudyStatus.DRAFT);
    }

    @Test
    @DisplayName("비공개 전환: 시작일이 지난 OPEN 은 STUDY_ALREADY_STARTED")
    void unpublish_afterStart() {
        var study = phased(StudyStatus.OPEN, days(-1), days(30));
        assertThatThrownBy(() -> study.unpublish(Instant.now()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.STUDY_ALREADY_STARTED);
        assertThat(study.getStatus()).isEqualTo(StudyStatus.OPEN);
    }

    @Test
    @DisplayName("비공개 전환: 종료일이 지난 OPEN 도 STUDY_ALREADY_STARTED")
    void unpublish_afterEnd() {
        var study = phased(StudyStatus.OPEN, days(-30), days(-1));
        assertThatThrownBy(() -> study.unpublish(Instant.now()))
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.STUDY_ALREADY_STARTED);
    }

    @Test
    @DisplayName("비공개 전환: DRAFT 는 CONFLICT")
    void unpublish_draft() {
        var study = phased(StudyStatus.DRAFT, days(3), null);
        assertThatThrownBy(() -> study.unpublish(Instant.now()))
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.CONFLICT);
    }

    private Study phased(StudyStatus status, Instant startAt, Instant endAt) {
        return Study.builder().programId(1L).status(status).startAt(startAt).endAt(endAt).build();
    }

    private Study getStudy(StudyStatus status) {
        return getStudy(status, 30);
    }

    private Study getStudy(StudyStatus status, Integer capacity) {
        return Study.builder().programId(1L).status(status).build();
    }
}
