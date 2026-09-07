package com.studyclub.domain.review;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "STUDY_REVIEW",
    uniqueConstraints = @UniqueConstraint(name = "uk_study_review_cohort_account", columnNames = {"STUDY_COHORT_ID", "ACCOUNT_ID"}),
    indexes = {
        @Index(name = "idx_study_review_account", columnList = "ACCOUNT_ID"),
        @Index(name = "idx_study_review_cohort", columnList = "STUDY_COHORT_ID"),
        @Index(name = "idx_study_review_study_created", columnList = "STUDY_ID, CREATED_AT")
    }
)
public class StudyReview extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "STUDY_COHORT_ID", nullable = false)
    private Long studyCohortId;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    protected StudyReview() {
    }

    public StudyReview(Long accountId, Long studyCohortId, Long studyId, String content) {
        this.accountId = accountId;
        this.studyCohortId = studyCohortId;
        this.studyId = studyId;
        this.content = content;
    }

    public Long getId() { return id; }
    public Long getAccountId() { return accountId; }
    public Long getStudyCohortId() { return studyCohortId; }
    public Long getStudyId() { return studyId; }
    public String getContent() { return content; }
}
