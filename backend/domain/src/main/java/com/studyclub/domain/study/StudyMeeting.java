package com.studyclub.domain.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

    protected StudyMeeting() {}

    public StudyMeeting(Long studyGroupId, Instant scheduledAt, Instant startAt, Instant endAt) {
        this.studyGroupId = studyGroupId;
        this.scheduledAt = scheduledAt;
        this.startAt = startAt;
        this.endAt = endAt;
    }

    /** 네비게이터가 화면에서 회차를 잡는다. 실제 시작·종료는 디스코드가 기록하므로 비워 둔다 (specs/study-meeting/spec.md). */
    public static StudyMeeting schedule(Long studyGroupId, Instant scheduledAt, String title) {
        StudyMeeting meeting = new StudyMeeting(studyGroupId, scheduledAt, null, null);
        meeting.title = normalizeTitle(title);
        return meeting;
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
        this.scheduledAt = scheduledAt;
        this.title = normalizeTitle(title);
    }

    // 공백뿐인 제목은 없는 제목이다 — 화면은 둘 다 「—」 로 보인다
    static String normalizeTitle(String title) {
        if (title == null || title.isBlank()) {
            return null;
        }
        String trimmed = title.strip();
        if (trimmed.length() > TITLE_MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "회차 제목은 " + TITLE_MAX_LENGTH + "자까지입니다.");
        }
        return trimmed;
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
}
