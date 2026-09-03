package com.studyclub.domain.study;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(
    name = "STUDY_CLASS",
    uniqueConstraints = @UniqueConstraint(name = "uk_study_class_cohort_name", columnNames = {"STUDY_COHORT_ID", "NAME"})
)
public class StudyClass extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "STUDY_COHORT_ID", nullable = false)
    private Long studyCohortId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "STARTS_AT")
    private Instant startsAt;

    @Column(length = 64)
    private String timezone;

    private Integer capacity;

    protected StudyClass() {
    }

    public StudyClass(Long studyCohortId, String name, Instant startsAt, String timezone, Integer capacity) {
        this.studyCohortId = studyCohortId;
        this.name = name;
        this.startsAt = startsAt;
        this.timezone = timezone;
        this.capacity = capacity;
    }

    public Long getId() { return id; }
    public Long getStudyCohortId() { return studyCohortId; }
    public String getName() { return name; }
    public Instant getStartsAt() { return startsAt; }
    public String getTimezone() { return timezone; }
    public Integer getCapacity() { return capacity; }
}
