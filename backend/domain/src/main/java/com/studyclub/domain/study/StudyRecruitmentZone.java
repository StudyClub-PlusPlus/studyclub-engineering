package com.studyclub.domain.study;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 모집 회차가 고른 지역 하나. {@link StudyRecruitment} 애그리거트 안의 자식이라 루트를 거쳐서만 바뀐다.
 * docs/erd/STUDY_RECRUITMENT_ZONE.md
 */
@Entity
@Table(
        name = "STUDY_RECRUITMENT_ZONE",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_study_recruitment_zone",
                        columnNames = {"STUDY_RECRUITMENT_ID", "TIME_ZONE"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StudyRecruitmentZone extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "TIME_ZONE", nullable = false, length = 64)
    private String timeZone;

    StudyRecruitmentZone(String timeZone) {
        this.timeZone = timeZone;
    }
}
