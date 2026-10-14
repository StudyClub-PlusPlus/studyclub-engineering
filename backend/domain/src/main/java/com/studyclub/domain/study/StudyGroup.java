package com.studyclub.domain.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
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

    /** 스터디 규칙 — 시트의 규칙 칸. 원문 그대로 저장하고 화면은 글자로만 그린다 (specs/study-meeting/spec.md 결정 12). */
    @Column(name = "RULES", length = RULES_MAX_LENGTH)
    private String rules;

    static final int RULES_MAX_LENGTH = 500;

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

    public String getRules() {
        return rules;
    }

    /**
     * 규칙을 바꾼다. 줄바꿈은 {@code \n} 으로 맞추고, 탭·줄바꿈 밖의 제어문자는 거절한다. 길이는 코드포인트로 500자 — 이모지 하나를 한 글자로 센다.
     * null·공백이면 지운다.
     */
    public void changeRules(String rules) {
        if (rules == null || rules.isBlank()) {
            this.rules = null;
            return;
        }
        String normalized = rules.replace("\r\n", "\n").replace('\r', '\n');
        if (normalized.codePoints().count() > RULES_MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "규칙은 " + RULES_MAX_LENGTH + "자까지입니다.");
        }
        boolean hasControl =
                normalized
                        .codePoints()
                        .anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\t');
        if (hasControl) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "규칙에 쓸 수 없는 문자가 있습니다.");
        }
        this.rules = normalized;
    }
}
