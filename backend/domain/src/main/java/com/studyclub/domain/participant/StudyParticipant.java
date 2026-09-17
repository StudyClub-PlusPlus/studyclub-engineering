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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "STUDY_PARTICIPANT",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_study_participant_account_class",
                        columnNames = {"ACCOUNT_ID", "STUDY_CLASS_ID"}),
        indexes = {
            @Index(name = "idx_study_participant_account", columnList = "ACCOUNT_ID"),
            @Index(
                    name = "idx_study_participant_class_status",
                    columnList = "STUDY_CLASS_ID, STATUS"),
            @Index(
                    name = "idx_study_participant_cohort_status",
                    columnList = "STUDY_COHORT_ID, STATUS")
        })
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudyParticipant extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "STUDY_CLASS_ID", nullable = false)
    private Long studyClassId;

    @Column(name = "STUDY_COHORT_ID", nullable = false)
    private Long studyCohortId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ParticipantStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "PARTICIPANT_ROLE", nullable = false, length = 20)
    private ParticipantRole participantRole;

    @Column(name = "JOINED_AT", nullable = false)
    private Instant joinedAt;
}
