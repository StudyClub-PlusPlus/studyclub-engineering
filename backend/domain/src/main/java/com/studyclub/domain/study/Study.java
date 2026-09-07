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

@Entity
@Table(
    name = "STUDY",
    uniqueConstraints = @UniqueConstraint(name = "uk_study_slug", columnNames = "SLUG")
)
public class Study extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String slug;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private StudyCategoryEnum category;

    @Enumerated(EnumType.STRING)
    @Column(name = "STUDY_KIND", nullable = false, length = 20)
    private StudyKindEnum studyKind;

    @Column(name = "THUMBNAIL_URL", length = 2048)
    private String thumbnailUrl;

    @Column(name = "IS_HIDDEN", nullable = false)
    private boolean isHidden = false;

    protected Study() {
    }

    public Study(String slug, String title, String description, StudyCategoryEnum category,
                 StudyKindEnum studyKind, String thumbnailUrl, boolean isHidden) {
        this.slug = slug;
        this.title = title;
        this.description = description;
        this.category = category;
        this.studyKind = studyKind;
        this.thumbnailUrl = thumbnailUrl;
        this.isHidden = isHidden;
    }

    public Long getId() { return id; }
    public String getSlug() { return slug; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public StudyCategoryEnum getCategory() { return category; }
    public StudyKindEnum getStudyKindEnum() { return studyKind; }
    public String getThumbnailUrl() { return thumbnailUrl; }
    public boolean isHidden() { return isHidden; }
}
