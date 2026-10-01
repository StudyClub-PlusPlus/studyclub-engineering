package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyTest {

    private static final int CAPACITY = 30;

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

    // ── 모집 상태 — 마감 시각과 정원은 둘 다 모집 회차에서 받는다 ────────────────────────

    @Test
    @DisplayName("모집 중 + 마감 전 + 정원 미달 → RECRUITING")
    void recruiting_beforeDeadlineAndUnderCapacity() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(29, days(7), CAPACITY)).isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감 시각이 정확히 지금 → RECRUIT_CLOSED (경계는 마감 쪽)")
    void recruitClosed_deadlineExactlyNow() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(0, Instant.now(), CAPACITY))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("마감 1초 전 → RECRUITING")
    void recruiting_oneSecondBeforeDeadline() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(0, Instant.now().plusSeconds(1), CAPACITY))
                .isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감 시각 경과 → RECRUIT_CLOSED")
    void recruitClosed_deadlinePassed() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(0, Instant.now().minusSeconds(1), CAPACITY))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("신청자 수 = 정원 → RECRUIT_CLOSED (정원 도달)")
    void recruitClosed_capacityReached() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(CAPACITY, days(30), CAPACITY))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("정원 초과 → RECRUIT_CLOSED")
    void recruitClosed_overCapacity() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(CAPACITY + 1, days(30), CAPACITY))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("정원 null (무제한) + 신청자 많음 → RECRUITING")
    void recruiting_nullCapacityNeverFills() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(9999, days(30), null)).isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감일 null + 정원 미달 → RECRUITING")
    void recruiting_nullDeadlineNeverExpires() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(1, null, CAPACITY)).isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감일 null + 정원 도달 → RECRUIT_CLOSED")
    void recruitClosed_nullDeadlineButCapacityReached() {
        var study = getStudy(StudyStatus.OPEN);
        assertThat(study.recruitStatus(CAPACITY, null, CAPACITY))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("DRAFT → 모집 상태 없음 (null). OPEN 일 때만 의미 있다")
    void noRecruitStatus_draft() {
        var study = getStudy(StudyStatus.DRAFT);
        assertThat(study.recruitStatus(0, days(7), CAPACITY)).isNull();
    }

    @Test
    @DisplayName("CLOSED → 모집 상태 없음 (null). 마감이 아니라 '없음'이다")
    void noRecruitStatus_closed() {
        var study = getStudy(StudyStatus.CLOSED);
        assertThat(study.recruitStatus(0, days(7), CAPACITY)).isNull();
    }

    // ── 단계 — STATUS 하나만 읽는다 (docs/erd/STUDY.md 「사용자 사이트 표기」) ──────────

    @Test
    @DisplayName("단계: DRAFT → 없음 (공개 목록 대상이 아니다)")
    void phase_draftIsNull() {
        assertThat(getStudy(StudyStatus.DRAFT).phase()).isNull();
    }

    @Test
    @DisplayName("단계: OPEN → RECRUITING. 모집 마감 여부는 recruitStatus 가 따로 가른다")
    void phase_openIsRecruiting() {
        assertThat(getStudy(StudyStatus.OPEN).phase()).isEqualTo(StudyPhase.RECRUITING);
    }

    @Test
    @DisplayName("단계: ONGOING → ONGOING")
    void phase_ongoing() {
        assertThat(getStudy(StudyStatus.ONGOING).phase()).isEqualTo(StudyPhase.ONGOING);
    }

    @Test
    @DisplayName("단계: ENDED · CLOSED → CLOSED (사용자에게 둘을 구분하지 않는다)")
    void phase_endedAndClosed() {
        assertThat(getStudy(StudyStatus.ENDED).phase()).isEqualTo(StudyPhase.CLOSED);
        assertThat(getStudy(StudyStatus.CLOSED).phase()).isEqualTo(StudyPhase.CLOSED);
    }

    @Test
    @DisplayName("단계: START_AT 이 지나도 OPEN 은 모집 중이다 — 날짜는 상태를 바꾸지 않는다")
    void phase_startAtDoesNotPromoteToOngoing() {
        var study = phased(StudyStatus.OPEN, days(-5), days(30));
        assertThat(study.phase()).isEqualTo(StudyPhase.RECRUITING);
    }

    @Test
    @DisplayName("단계: START_AT 이 비어 있어도 ONGOING 은 진행 중이다 — 종료로 밀리지 않는다")
    void phase_ongoingWithoutStartAt() {
        var study = phased(StudyStatus.ONGOING, null, null);
        assertThat(study.phase()).isEqualTo(StudyPhase.ONGOING);
    }

    @Test
    @DisplayName("단계: END_AT 이 지나도 운영자가 끝내지 않은 ONGOING 은 진행 중이다")
    void phase_endAtDoesNotCloseOngoing() {
        var study = phased(StudyStatus.ONGOING, days(-30), days(-1));
        assertThat(study.phase()).isEqualTo(StudyPhase.ONGOING);
    }

    // ── 공개 여부 — STATUS != DRAFT 하나다 (docs/erd/STUDY.md 「공개 여부」) ──────────

    @Test
    @DisplayName("공개: DRAFT 만 비공개다")
    void publiclyVisible_onlyDraftIsHidden() {
        assertThat(getStudy(StudyStatus.DRAFT).isPubliclyVisible()).isFalse();
        assertThat(getStudy(StudyStatus.OPEN).isPubliclyVisible()).isTrue();
        assertThat(getStudy(StudyStatus.ONGOING).isPubliclyVisible()).isTrue();
        assertThat(getStudy(StudyStatus.ENDED).isPubliclyVisible()).isTrue();
        assertThat(getStudy(StudyStatus.CLOSED).isPubliclyVisible()).isTrue();
    }

    @Test
    @DisplayName("시간대: PDT·PST → PST, KST → KST, 표기 없음 → BOTH")
    void timezone_fromSchedule() {
        assertThat(scheduled("Thu 6:00 PM PDT").timezone()).isEqualTo(StudyTimezone.PST);
        assertThat(scheduled("매주 목 20:00 pst").timezone()).isEqualTo(StudyTimezone.PST);
        assertThat(scheduled("매주 화 21:00 KST").timezone()).isEqualTo(StudyTimezone.KST);
        assertThat(scheduled("매주 화 21:00").timezone()).isEqualTo(StudyTimezone.BOTH);
        assertThat(scheduled(null).timezone()).isEqualTo(StudyTimezone.BOTH);
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

    private Study phased(StudyStatus status, Instant startAt, Instant endAt) {
        return Study.builder()
                .programId(1L)
                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                .status(status)
                .startAt(startAt)
                .endAt(endAt)
                .build();
    }

    private Study scheduled(String schedule) {
        return Study.builder().programId(1L).status(StudyStatus.OPEN).schedule(schedule).build();
    }

    private Study getStudy(StudyStatus status) {
        return Study.builder()
                .programId(1L)
                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                .status(status)
                .build();
    }
}
