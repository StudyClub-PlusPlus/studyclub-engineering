package com.studyclub.domain.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(
        name = "STUDY_MEETING",
        indexes =
                @Index(
                        name = "idx_study_meeting_group_scheduled",
                        columnList = "STUDY_GROUP_ID, SCHEDULED_AT"))
public class StudyMeeting extends BaseEntity {

    static final int TITLE_MAX_LENGTH = 50;
    static final String KICKOFF_TITLE = "킥오프";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "STUDY_GROUP_ID", nullable = false)
    private Long studyGroupId;

    @Column(name = "SCHEDULED_AT", nullable = false)
    private Instant scheduledAt;

    @Column(name = "START_AT")
    private Instant startAt;

    @Column(name = "END_AT")
    private Instant endAt;

    @Column(name = "TITLE", length = TITLE_MAX_LENGTH)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "MEETING_TYPE", nullable = false, length = 16)
    private MeetingType meetingType = MeetingType.REGULAR;

    // 발표자 칸은 명부 행(STUDY_PARTICIPANT.ID)을 가리킨다. 애그리거트가 달라 외래키 없이 ID 로만 잡는다
    @Column(name = "PRESENTER1_PARTICIPANT_ID")
    private Long presenter1ParticipantId;

    @Column(name = "PRESENTER2_PARTICIPANT_ID")
    private Long presenter2ParticipantId;

    /** 한 요청으로 함께 만든 반복 회차 묶음. 지금은 저장만 하고 쓰는 기능이 없다 (결정 2). */
    @Column(name = "SERIES_ID", length = 36)
    private String seriesId;

    protected StudyMeeting() {}

    public StudyMeeting(Long studyGroupId, Instant scheduledAt, Instant startAt, Instant endAt) {
        this.studyGroupId = studyGroupId;
        this.scheduledAt = scheduledAt;
        this.startAt = startAt;
        this.endAt = endAt;
    }

    /** 네비게이터가 화면에서 회차를 잡는다. 실제 시작·종료는 디스코드가 기록하므로 비워 둔다 (specs/study-meeting/spec.md). */
    public static StudyMeeting schedule(Long studyGroupId, Instant scheduledAt, String title) {
        return schedule(studyGroupId, scheduledAt, title, null);
    }

    /** 반복으로 함께 만든 회차는 같은 {@code seriesId} 를 받는다. 한 번만 만든 회차는 null. */
    public static StudyMeeting schedule(
            Long studyGroupId, Instant scheduledAt, String title, String seriesId) {
        StudyMeeting meeting =
                new StudyMeeting(studyGroupId, MeetingSchedule.storable(scheduledAt), null, null);
        meeting.title = normalizeTitle(title);
        meeting.seriesId = seriesId;
        return meeting;
    }

    /** 분반의 킥오프(0회차). 분반을 만들 때 함께 만든다 — 일자는 네비게이터가 나중에 고친다. 반 만들기 API 가 생기면 거기서 부른다 (구현 메모). */
    public static StudyMeeting kickoff(Long studyGroupId, Instant scheduledAt) {
        StudyMeeting meeting =
                new StudyMeeting(studyGroupId, MeetingSchedule.storable(scheduledAt), null, null);
        meeting.title = KICKOFF_TITLE;
        meeting.meetingType = MeetingType.KICKOFF;
        return meeting;
    }

    public boolean isKickoff() {
        return meetingType == MeetingType.KICKOFF;
    }

    /** 킥오프는 지우지 않는다 — 분반마다 반드시 하나 있다. 시작한 회차도 출석이 있어 지우지 않는다. */
    public void assertDeletable(Instant now) {
        if (isKickoff()) {
            throw new BusinessException(ErrorCode.KICKOFF_NOT_DELETABLE, "킥오프는 지울 수 없습니다.");
        }
        assertNotStarted(now);
    }

    /**
     * 네비게이터·캡틴이 발표자 두 칸을 정한다. 넘긴 값이 결과 값이다 — 바꾸지 않는 칸은 호출하는 쪽이 지금 값을 넘긴다. 같은 사람을 두 칸에 넣을 수 없고,
     * 킥오프에는 발표자가 없다. 시작 판정은 {@link #reschedule} 이 이미 한다.
     */
    public void assignPresenters(Long presenter1, Long presenter2) {
        if (isKickoff() && (presenter1 != null || presenter2 != null)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "킥오프에는 발표자를 두지 않습니다.");
        }
        if (presenter1 != null && presenter1.equals(presenter2)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "발표자1과 다른 사람을 골라 주세요.");
        }
        this.presenter1ParticipantId = presenter1;
        this.presenter2ParticipantId = presenter2;
    }

    /** 크루가 빈 발표자 칸에 자기를 넣는다. 선착순 — 찬 칸에는 넣지 않고, 한 회차에 한 칸만. */
    public void signUpPresenter(int slot, Long participantId, Instant now) {
        assertPresenterSlotOpen(slot, now);
        if (presenterAt(slot) != null) {
            throw new BusinessException(
                    ErrorCode.PRESENTER_SLOT_TAKEN, "다른 크루가 먼저 발표자" + slot + " 로 신청했습니다.");
        }
        if (participantId.equals(presenterAt(otherSlot(slot)))) {
            throw new BusinessException(
                    ErrorCode.PRESENTER_ALREADY_ASSIGNED, "이 회차에는 이미 발표자로 들어가 있습니다.");
        }
        setPresenterAt(slot, participantId);
    }

    /** 크루가 자기가 들어간 발표자 칸에서 빠진다. 다른 사람 이름은 뺄 수 없다. */
    public void cancelPresenter(int slot, Long participantId, Instant now) {
        assertPresenterSlotOpen(slot, now);
        if (!participantId.equals(presenterAt(slot))) {
            throw new BusinessException(ErrorCode.PRESENTER_NOT_ME, "내가 신청한 칸이 아닙니다.");
        }
        setPresenterAt(slot, null);
    }

    /**
     * 참여자가 분반을 떠나면 그가 맡은 예정 회차의 발표자 칸을 비운다. 시작한 회차는 기록이라 둔다.
     *
     * @return 칸을 비웠으면 true
     */
    public boolean releasePresenter(Long participantId, Instant now) {
        if (isStarted(now)) {
            return false;
        }
        boolean changed = false;
        if (participantId.equals(presenter1ParticipantId)) {
            presenter1ParticipantId = null;
            changed = true;
        }
        if (participantId.equals(presenter2ParticipantId)) {
            presenter2ParticipantId = null;
            changed = true;
        }
        return changed;
    }

    private void assertPresenterSlotOpen(int slot, Instant now) {
        if (slot != 1 && slot != 2) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "발표자 칸은 1 또는 2 입니다.");
        }
        if (isKickoff()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "킥오프에는 발표자를 두지 않습니다.");
        }
        assertNotStarted(now);
    }

    private Long presenterAt(int slot) {
        if (slot == 1) return presenter1ParticipantId;
        if (slot == 2) return presenter2ParticipantId;
        throw new IllegalArgumentException("발표자 칸은 1 또는 2 입니다: " + slot);
    }

    private void setPresenterAt(int slot, Long participantId) {
        if (slot == 1) {
            presenter1ParticipantId = participantId;
        } else {
            presenter2ParticipantId = participantId;
        }
    }

    private static int otherSlot(int slot) {
        return slot == 1 ? 2 : 1;
    }

    /** 시작한 회차인지 — 예정 시각이 지났거나, 디스코드 출석이 예정 시각 전에 이미 열었다. 시작한 회차에는 출석이 찍혀 있을 수 있어 고치거나 지우지 않는다. */
    public boolean isStarted(Instant now) {
        return startAt != null || !now.isBefore(scheduledAt);
    }

    public void assertNotStarted(Instant now) {
        if (isStarted(now)) {
            throw new BusinessException(
                    ErrorCode.MEETING_ALREADY_STARTED, "이미 시작한 회차는 고치거나 지울 수 없습니다.");
        }
    }

    /**
     * 시작 전 회차의 시각·제목을 고친다. ID 가 그대로라 그 회차의 출석(휴가 포함)이 따라온다. 같은 날 중복은 {@link MeetingSchedule} 이 본다.
     */
    public void reschedule(Instant scheduledAt, String title, Instant now) {
        assertNotStarted(now);
        MeetingSchedule.assertFuture(scheduledAt, now);
        this.scheduledAt = MeetingSchedule.storable(scheduledAt);
        this.title = normalizeTitle(title);
    }

    // 공백뿐인 제목은 없는 제목이다 — 화면은 둘 다 「—」 로 보인다
    static String normalizeTitle(String title) {
        if (title == null) {
            return null;
        }
        // 길이는 공백을 떼기 전 입력으로 잰다 — 스펙은 입력 50자 초과를 400 으로 정했다
        if (title.length() > TITLE_MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "회차 제목은 " + TITLE_MAX_LENGTH + "자까지입니다.");
        }
        return title.isBlank() ? null : title.strip();
    }

    /** 회차가 진행 중인지 — 시작했고 아직 끝나지 않았다. 상태를 저장하지 않으므로 시각으로 판정한다. */
    public boolean isInProgress() {
        return startAt != null && endAt == null;
    }

    /** 아직 시작하지 않았는지. */
    public boolean isNotStarted() {
        return startAt == null;
    }

    /**
     * 회차를 시작한다. 디스코드 출석 체크가 예정 회차를 자동으로 열 때 쓴다 (specs/discord-attendance/spec.md).
     *
     * @throws IllegalStateException 이미 시작했을 때 — 시작 시각을 덮어쓰면 진행 중 판정이 흔들린다
     */
    public void start(Instant at) {
        if (startAt != null) {
            throw new IllegalStateException("이미 시작한 회차입니다: " + id);
        }
        this.startAt = at;
    }

    public Long getId() {
        return id;
    }

    public Long getStudyGroupId() {
        return studyGroupId;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public Instant getStartAt() {
        return startAt;
    }

    public Instant getEndAt() {
        return endAt;
    }

    public String getTitle() {
        return title;
    }

    public MeetingType getMeetingType() {
        return meetingType;
    }

    public Long getPresenter1ParticipantId() {
        return presenter1ParticipantId;
    }

    public Long getPresenter2ParticipantId() {
        return presenter2ParticipantId;
    }

    public String getSeriesId() {
        return seriesId;
    }
}
