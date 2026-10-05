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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "STUDY_PROGRAM")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudyProgram extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    /**
     * 종류 — 이 프로그램이 한 번 진행하는 스터디인지, 기수를 쌓는 클럽인지.
     *
     * <p>기수(STUDY)가 아니라 <b>프로그램의 속성</b>이고, <b>한 번 정하면 바꾸지 못한다</b> — docs/erd/STUDY_PROGRAM.md. 바꾸는
     * 메서드를 두지 않는 것이 그 규칙의 구현이다. 「새 기수는 클럽에만 붙일 수 있다」는 판정이 이 값을 읽는다.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "STUDY_KIND", nullable = false, length = 20)
    private StudyKind studyKind;
}
