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

@Entity
@Table(
    name = "STUDY_APPLICATION",
    uniqueConstraints = @UniqueConstraint(name = "uk_study_application_cohort_account", columnNames = {"STUDY_COHORT_ID", "ACCOUNT_ID"}),
    indexes = {
        @Index(name = "idx_study_application_account", columnList = "ACCOUNT_ID"),
        @Index(name = "idx_study_application_cohort_status", columnList = "STUDY_COHORT_ID, STATUS")
    }
)
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
    private ApplicationStatusEnum status;

    @Column(name = "FORM_ANSWER", nullable = false, columnDefinition = "json")
    private String formAnswer;

    protected StudyApplication() {
    }

    public StudyApplication(Long accountId, Long studyCohortId, ApplicationStatusEnum status, String formAnswer) {
        this.accountId = accountId;
        this.studyCohortId = studyCohortId;
        this.status = status;
        this.formAnswer = formAnswer;
    }

    public Long getId() { return id; }
    public Long getAccountId() { return accountId; }
    public Long getStudyCohortId() { return studyCohortId; }
    public ApplicationStatusEnum getStatus() { return status; }
    public String getFormAnswer() { return formAnswer; }
}
