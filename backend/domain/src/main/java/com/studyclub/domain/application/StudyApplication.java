package com.studyclub.domain.application;

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
        name = "STUDY_APPLICATION",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_study_application_recruitment_account",
                        columnNames = {"RECRUITMENT_ID", "ACCOUNT_ID"}),
        indexes = {@Index(name = "idx_study_application_account", columnList = "ACCOUNT_ID")})
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

    @Column(name = "RECRUITMENT_ID", nullable = false)
    private Long recruitmentId;

    @Column(name = "FORM_ANSWER", nullable = false, columnDefinition = "json")
    private String formAnswer;
}
