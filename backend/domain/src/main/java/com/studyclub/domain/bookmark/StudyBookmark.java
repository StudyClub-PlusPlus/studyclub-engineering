package com.studyclub.domain.bookmark;

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
    name = "STUDY_BOOKMARK",
    uniqueConstraints = @UniqueConstraint(name = "uk_study_bookmark_account_cohort", columnNames = {"ACCOUNT_ID", "STUDY_COHORT_ID"}),
    indexes = {
        @Index(name = "idx_study_bookmark_account", columnList = "ACCOUNT_ID"),
        @Index(name = "idx_study_bookmark_cohort", columnList = "STUDY_COHORT_ID")
    }
)

public class StudyBookmark extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "STUDY_COHORT_ID", nullable = false)
    private Long studyCohortId;

    protected StudyBookmark() {}

    public StudyBookmark(Long accountId, Long studyCohortId) {
        this.accountId = accountId;
        this.studyCohortId = studyCohortId;
    }

    public Long getId() { return id; }
    public Long getAccountId() { return accountId; }
    public Long getStudyCohortId() { return studyCohortId; }
}
