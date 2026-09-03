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
    indexes = @Index(name = "idx_study_meeting_class_scheduled", columnList = "STUDY_CLASS_ID, SCHEDULED_AT")
)
public class StudyMeeting extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "STUDY_CLASS_ID", nullable = false)
    private Long studyClassId;

    @Column(name = "SCHEDULED_AT", nullable = false)
    private Instant scheduledAt;

    @Column(name = "STARTS_AT")
    private Instant startsAt;

    @Column(name = "ENDS_AT")
    private Instant endsAt;

    protected StudyMeeting() {
    }

    public StudyMeeting(Long studyClassId, Instant scheduledAt, Instant startsAt, Instant endsAt) {
        this.studyClassId = studyClassId;
        this.scheduledAt = scheduledAt;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
    }

    public Long getId() { return id; }
    public Long getStudyClassId() { return studyClassId; }
    public Instant getScheduledAt() { return scheduledAt; }
    public Instant getStartsAt() { return startsAt; }
    public Instant getEndsAt() { return endsAt; }
}
