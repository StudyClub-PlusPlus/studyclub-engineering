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
