package com.studyclub.domain.study;

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

    protected StudyMeeting() {}

    public StudyMeeting(Long studyGroupId, Instant scheduledAt, Instant startAt, Instant endAt) {
        this.studyGroupId = studyGroupId;
        this.scheduledAt = scheduledAt;
        this.startAt = startAt;
        this.endAt = endAt;
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
}
