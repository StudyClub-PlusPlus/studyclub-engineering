package com.studyclub.domain.study;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.regex.Pattern;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
        name = "STUDY",
        indexes =
                @Index(name = "idx_study_program_study_status", columnList = "PROGRAM_ID, STATUS"))
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Study extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "PROGRAM_ID", nullable = false)
    private Long programId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "ONE_LINE_SUMMARY", nullable = false, length = 255)
    private String oneLineSummary;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private StudyCategory category;

    @Column(name = "THUMBNAIL_URL", length = 2048)
    private String thumbnailUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudyStatus status;

    @Column(name = "APPLICATION_FORM", columnDefinition = "json")
    @JdbcTypeCode(SqlTypes.JSON)
    private String applicationForm;

    @Column(columnDefinition = "json")
    private String curriculum;

    @Column(name = "START_AT")
    private Instant startAt;

    @Column(name = "END_AT")
    private Instant endAt;

    @Column(name = "DISCORD_CHANNEL_URL", length = 2048)
    private String discordChannelUrl;

    @Column(name = "DRIVE_URL", length = 2048)
    private String driveUrl;

    @Column(length = 255)
    private String schedule;

    @Column(name = "PUBLISH_AT")
    private Instant publishAt;

    @Column(name = "CREATED_BY")
    private Long createdBy;

    private static final long CLOSING_SOON_DAYS = 3;
    private static final Pattern PST_PATTERN = Pattern.compile("PST|PDT", Pattern.CASE_INSENSITIVE);
    private static final Pattern KST_PATTERN = Pattern.compile("KST", Pattern.CASE_INSENSITIVE);

    public void update(
            String title,
            String oneLineSummary,
            String description,
            StudyCategory category,
            String schedule) {
        if (title != null) this.title = title.trim();
        if (oneLineSummary != null) this.oneLineSummary = oneLineSummary.trim();
        if (description != null) this.description = description;
        if (category != null) this.category = category;
        if (schedule != null) this.schedule = schedule;
    }

    /** 진행 시작일. {@code null} 이면 미정. */
    public void changeStartAt(Instant startAt) {
        this.startAt = startAt;
    }

    public void changeDiscordChannelUrl(String discordChannelUrl) {
        this.discordChannelUrl = blankToNull(discordChannelUrl);
    }

    /** 썸네일 주소. 올리기 API 가 준 우리 저장소 주소만 들어온다 — 외부 주소 문자열을 받지 않는다. {@code null} 이면 없음. */
    public void changeThumbnailUrl(String thumbnailUrl) {
        this.thumbnailUrl = thumbnailUrl;
    }

    public void changeDriveUrl(String driveUrl) {
        this.driveUrl = blankToNull(driveUrl);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public boolean isClosingSoon(Instant recruitDeadlineAt) {
        return isClosingSoon(recruitDeadlineAt, Instant.now());
    }

    /**
     * 모집 임박 여부. {@code asOf} 는 집계 기준 시각이다 — 대시보드처럼 한 응답 안에서 같은 시계를 쓸 때 넘긴다.
     *
     * <p>조건: {@code OPEN} 이고 마감이 {@code asOf} 이후이며, {@code asOf} 로부터 3일(72시간) 미만이다. 정확히 72시간이면 임박이
     * 아니다.
     */
    public boolean isClosingSoon(Instant recruitDeadlineAt, Instant asOf) {
        return status == StudyStatus.OPEN
                && recruitDeadlineAt != null
                && recruitDeadlineAt.isAfter(asOf)
                && recruitDeadlineAt.isBefore(asOf.plus(CLOSING_SOON_DAYS, ChronoUnit.DAYS));
    }

    /**
     * 모집 상태를 계산한다. {@code STATUS = OPEN} 일 때만 의미가 있어 그 밖에서는 {@code null} 을 돌려준다 — 모집 상태가 "없는" 것이지
     * 마감된 것이 아니다.
     *
     * <p>{@code recruitDeadlineAt == null} 은 상시 모집이라 시각으로는 마감되지 않고, {@code recruitmentCapacity ==
     * null} 은 무제한이라 정원으로도 마감되지 않는다.
     *
     * <p>신청 수는 STUDY_APPLICATION 애그리거트 소관이라 밖에서 받는다. 정원과 같은 회차끼리 비교해야 하므로 최신 모집 회차의 신청 수 ({@code
     * StudyApplicationRepository.countByRecruitmentIdIn}) 를 넘긴다.
     *
     * <p>{@code recruitDeadlineAt} · {@code recruitmentCapacity} 는 STUDY_RECRUITMENT 에서 가져온 값이다.
     */
    public RecruitStatus recruitStatus(
            long applicantCount, Instant recruitDeadlineAt, Integer recruitmentCapacity) {
        return recruitStatus(applicantCount, recruitDeadlineAt, recruitmentCapacity, Instant.now());
    }

    /**
     * {@link #recruitStatus(long, Instant, Integer)} 와 같되 마감 판정에 {@code asOf} 를 쓴다 — 대시보드 집계 기준 시각.
     */
    public RecruitStatus recruitStatus(
            long applicantCount,
            Instant recruitDeadlineAt,
            Integer recruitmentCapacity,
            Instant asOf) {
        if (status != StudyStatus.OPEN) {
            return null;
        }
        boolean deadlinePassed = recruitDeadlineAt != null && !asOf.isBefore(recruitDeadlineAt);
        boolean capacityReached =
                recruitmentCapacity != null && applicantCount >= recruitmentCapacity;
        return (deadlinePassed || capacityReached)
                ? RecruitStatus.RECRUIT_CLOSED
                : RecruitStatus.RECRUITING;
    }

    /**
     * 목록 탭 단계를 계산한다. {@code DRAFT} 는 공개 목록에 나오지 않아 {@code null} 이다.
     *
     * <p>판정 순서: 종료(운영자 종료 또는 {@code END_AT} 경과) → 진행 중({@code START_AT} 경과) → 모집 중(모집 상태가 {@code
     * RECRUITING}) → 나머지는 종료. 시작 전인데 모집이 마감된 스터디는 신청할 수 없으니 종료로 본다.
     */
    public StudyPhase phase(
            long applicantCount, Instant recruitDeadlineAt, Integer recruitmentCapacity) {
        if (status == StudyStatus.DRAFT) {
            return null;
        }
        Instant now = Instant.now();
        if (status == StudyStatus.CLOSED || (endAt != null && !now.isBefore(endAt))) {
            return StudyPhase.CLOSED;
        }
        if (startAt != null && !now.isBefore(startAt)) {
            return StudyPhase.ONGOING;
        }
        return recruitStatus(applicantCount, recruitDeadlineAt, recruitmentCapacity)
                        == RecruitStatus.RECRUITING
                ? StudyPhase.RECRUITING
                : StudyPhase.CLOSED;
    }

    /**
     * 진행 시간대를 일정 문구({@code SCHEDULE})의 표기로 판정한다. PST·PDT 가 있으면 PST, KST 가 있으면 KST, 둘 다 없으면 두 지역 동시
     * 모집이다.
     */
    // ponytail: 자유 텍스트 판정 — 표기가 흔들리면 틀린다. 운영에서 문제가 되면 TIMEZONE 컬럼으로 올린다
    public StudyTimezone timezone() {
        if (schedule == null) {
            return StudyTimezone.BOTH;
        }
        if (PST_PATTERN.matcher(schedule).find()) {
            return StudyTimezone.PST;
        }
        if (KST_PATTERN.matcher(schedule).find()) {
            return StudyTimezone.KST;
        }
        return StudyTimezone.BOTH;
    }

    public boolean isPubliclyVisible() {
        return status != StudyStatus.DRAFT;
    }

    public void replaceApplicationForm(String applicationForm) {
        this.applicationForm = applicationForm;
    }

    /** DRAFT → OPEN. 선행 조건(폼·상태) 검사는 서비스에서 한다. */
    public void publish() {
        this.status = StudyStatus.OPEN;
    }

    /** OPEN → DRAFT. 선행 조건 검사는 서비스에서 한다. */
    public void unpublish() {
        this.status = StudyStatus.DRAFT;
    }
}
