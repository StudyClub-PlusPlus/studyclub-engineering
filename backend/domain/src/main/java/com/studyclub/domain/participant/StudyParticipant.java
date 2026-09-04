package com.studyclub.domain.participant;

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
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(
    name = "STUDY_PARTICIPANT",
    uniqueConstraints = @UniqueConstraint(name = "uk_study_participant_user_class", columnNames = {"USER_ID", "STUDY_CLASS_ID"}),
    indexes = {
        @Index(name = "idx_study_participant_user", columnList = "USER_ID"),
        @Index(name = "idx_study_participant_class_status", columnList = "STUDY_CLASS_ID, STATUS"),
        @Index(name = "idx_study_participant_cohort_status", columnList = "STUDY_COHORT_ID, STATUS")
    }
)
public class StudyParticipant extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "USER_ID", nullable = false)
    private Long userId;

    @Column(name = "STUDY_CLASS_ID", nullable = false)
    private Long studyClassId;

    @Column(name = "STUDY_COHORT_ID", nullable = false)
    private Long studyCohortId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ParticipantStatusEnum status;

    @Enumerated(EnumType.STRING)
    @Column(name = "PARTICIPANT_ROLE", nullable = false, length = 20)
    private ParticipantRoleEnum participantRole;

    @Column(name = "JOINED_AT", nullable = false)
    private Instant joinedAt;

    protected StudyParticipant() {
    }

    public StudyParticipant(Long userId, Long studyClassId, Long studyCohortId,
                            ParticipantStatusEnum status, ParticipantRoleEnum participantRole, Instant joinedAt) {
        this.userId = userId;
        this.studyClassId = studyClassId;
        this.studyCohortId = studyCohortId;
        this.status = status;
        this.participantRole = participantRole;
        this.joinedAt = joinedAt;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getStudyClassId() { return studyClassId; }
    public Long getStudyCohortId() { return studyCohortId; }
    public ParticipantStatusEnum getStatus() { return status; }
    public ParticipantRoleEnum getParticipantRoleEnum() { return participantRole; }
    public Instant getJoinedAt() { return joinedAt; }
}
