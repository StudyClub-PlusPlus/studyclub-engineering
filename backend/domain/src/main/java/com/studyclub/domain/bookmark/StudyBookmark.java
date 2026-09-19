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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "STUDY_BOOKMARK",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_study_bookmark_account_study",
                        columnNames = {"ACCOUNT_ID", "STUDY_ID"}),
        indexes = {
            @Index(name = "idx_study_bookmark_account", columnList = "ACCOUNT_ID"),
            @Index(name = "idx_study_bookmark_study", columnList = "STUDY_ID")
        })
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudyBookmark extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;
}
