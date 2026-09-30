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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "STUDY_REVIEW",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_study_review_study_account",
                        columnNames = {"STUDY_ID", "ACCOUNT_ID"}),
        indexes = {
            @Index(name = "idx_study_review_account", columnList = "ACCOUNT_ID"),
            @Index(name = "idx_study_review_study", columnList = "STUDY_ID"),
            @Index(
                    name = "idx_study_review_program_created",
                    columnList = "STUDY_PROGRAM_ID, CREATED_AT")
        })
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudyReview extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    @Column(name = "STUDY_PROGRAM_ID", nullable = false)
    private Long studyProgramId;

    @Column(nullable = false, columnDefinition = "text")
    private String content;
}
