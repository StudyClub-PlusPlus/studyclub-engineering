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

    public static final int RULES_MAX_LENGTH = 500;

    /** 반 제목 상한 — 카드 한 줄에 들어가는 길이 (specs/study-group/spec.md 「반 만들기」). 컬럼은 255 그대로다. */
    public static final int NAME_MAX_LENGTH = 20;

    /** 스터디를 만들 때 같이 생기는 반의 이름. 캡틴이 반을 나누면 이름을 바꿔 쓴다. */
    public static final String DEFAULT_NAME = "기본반";

    protected StudyGroup() {}

    /**
     * 캡틴이 제목만 정해 반을 만든다. 스터디 시간(시각·시간대)·정원·규칙은 비워 둔다 — 시간은 일정 탭에서 따로 정하고, 회차는 회차 추가로만 생긴다 (share
     * 10-14).
     */
    public static StudyGroup create(Long studyId, String name) {
        return new StudyGroup(studyId, normalizeName(name), null, null, null);
    }

    /** 앞뒤 공백을 자르고 코드포인트로 센다 — 이모지 하나를 한 글자로. 비었거나 20자를 넘으면 400. */
    public static String normalizeName(String name) {
        String trimmed = name == null ? "" : name.strip();
        if (trimmed.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "반 제목을 입력하세요.");
        }
        if (trimmed.codePoints().count() > NAME_MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "반 제목은 " + NAME_MAX_LENGTH + "자까지입니다.");
        }
        return trimmed;
    }

    public StudyGroup(
            Long studyId, String name, Instant startAt, String timezone, Integer capacity) {
        this.studyId = studyId;
        this.name = name;
        this.startAt = startAt;
        this.timezone = timezone;
        this.capacity = capacity;
    }

    /**
     * 기본 반 — 스터디를 만들 때 같이 만든다. 회차·출석·명부가 모두 반에 붙어서, 반이 없으면 신청자를 명부에 넣을 수도 일정을 짤 수도 없다. 시각·시간대는 캡틴이
     * 일정 탭에서 정한다.
     */
    public static StudyGroup defaultOf(Long studyId) {
        return new StudyGroup(studyId, DEFAULT_NAME, null, null, null);
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

    /** 반 제목을 바꾼다. 길이·공백 규칙은 {@link #normalizeName} 이 본다. */
    public void changeName(String name) {
        this.name = normalizeName(name);
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
