package com.studyclub.domain.study;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(
        name = "STUDY_GROUP",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_study_group_study_name",
                        columnNames = {"STUDY_ID", "NAME"}),
        indexes = @Index(name = "idx_study_group_study", columnList = "STUDY_ID"))
public class StudyGroup extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "START_AT")
    private Instant startAt;

    @Column(length = 64)
    private String timezone;

    private Integer capacity;

    protected StudyGroup() {}

    public StudyGroup(
            Long studyId, String name, Instant startAt, String timezone, Integer capacity) {
        this.studyId = studyId;
        this.name = name;
        this.startAt = startAt;
        this.timezone = timezone;
        this.capacity = capacity;
    }

    public Long getId() {
        return id;
    }

    public Long getStudyId() {
        return studyId;
    }

    public String getName() {
        return name;
    }

    public Instant getStartAt() {
        return startAt;
    }

    public String getTimezone() {
        return timezone;
    }

    public Integer getCapacity() {
        return capacity;
    }
}
