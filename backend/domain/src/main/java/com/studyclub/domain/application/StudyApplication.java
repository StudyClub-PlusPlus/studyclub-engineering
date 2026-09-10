package com.studyclub.domain.application;

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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "STUDY_APPLICATION",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_study_application_cohort_account",
                        columnNames = {"STUDY_COHORT_ID", "ACCOUNT_ID"}),
        indexes = {
            @Index(name = "idx_study_application_account", columnList = "ACCOUNT_ID"),
            @Index(
                    name = "idx_study_application_cohort_status",
                    columnList = "STUDY_COHORT_ID, STATUS")
        })
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudyApplication extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "STUDY_COHORT_ID", nullable = false)
    private Long studyCohortId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApplicationStatus status;

    @Column(name = "FORM_ANSWER", nullable = false, columnDefinition = "json")
    private String formAnswer;
}
