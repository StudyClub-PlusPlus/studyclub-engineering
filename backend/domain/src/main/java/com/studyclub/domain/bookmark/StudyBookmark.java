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
    uniqueConstraints = @UniqueConstraint(name = "uk_study_bookmark_user_study", columnNames = {"USER_ID", "STUDY_ID"}),
    indexes = {
        @Index(name = "idx_study_bookmark_user", columnList = "USER_ID"),
        @Index(name = "idx_study_bookmark_study", columnList = "STUDY_ID")
    }
)
public class StudyBookmark extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "USER_ID", nullable = false)
    private Long userId;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    protected StudyBookmark() {
    }

    public StudyBookmark(Long userId, Long studyId) {
        this.userId = userId;
        this.studyId = studyId;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getStudyId() { return studyId; }
}
