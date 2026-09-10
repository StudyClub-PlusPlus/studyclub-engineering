package com.studyclub.domain.study;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "STUDY",
        uniqueConstraints = @UniqueConstraint(name = "uk_study_slug", columnNames = "SLUG"))
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Study extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String slug;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "ONE_LINE_SUMMARY", length = 255)
    private String oneLineSummary;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private StudyCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "STUDY_KIND", nullable = false, length = 20)
    private StudyKind studyKind;

    @Column(name = "THUMBNAIL_URL", length = 2048)
    private String thumbnailUrl;

    @Column(name = "IS_HIDDEN", nullable = false)
    private boolean isHidden;
}
