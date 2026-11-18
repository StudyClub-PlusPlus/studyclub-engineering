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
import org.hibernate.annotations.DynamicUpdate;
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
// 바뀐 칸만 UPDATE 한다 — 잠그지 않고 읽은 스터디 수정이 그사이 바뀐 담당 캡틴(OWNER_CAPTAIN_ID)을 옛 값으로 되돌리지 않게
@DynamicUpdate
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

    /** 운영자가 고른 기준 시간대. {@code null} = 미정 — 판정은 {@link #timezone()}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "TIMEZONE", length = 10)
    private StudyTimezone timezone;

    @Column(name = "PUBLISH_AT")
    private Instant publishAt;

    /** 등록한 사람 — 기록만. 권한 판정에 쓰지 않는다 (담당 캡틴은 {@link #ownerCaptainId}). */
    @Column(name = "CREATED_BY")
    private Long createdBy;

    /** 담당 캡틴 — 스터디당 한 명. NULL 이면 담당 캡틴의 일을 캡틴 누구나 한다 (POL-0001). */
    @Column(name = "OWNER_CAPTAIN_ID")
    private Long ownerCaptainId;

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

    /** 기준 시간대. {@code null} 이면 미정으로 되돌린다. */
    public void changeTimezone(StudyTimezone timezone) {
        this.timezone = timezone;
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
     * <p>정원을 차지하는 인원은 STUDY_PARTICIPANT 애그리거트 소관이라 밖에서 받는다. 현재 ACTIVE 명부({@code
     * StudyParticipantRepository.countCapacityHoldersByStudyIds}) 를 넘긴다 (결정 D4-A).
     *
     * <p>{@code recruitDeadlineAt} · {@code recruitmentCapacity} 는 STUDY_RECRUITMENT 에서 가져온 값이다.
     */
    public RecruitStatus recruitStatus(
            long crewCount, Instant recruitDeadlineAt, Integer recruitmentCapacity) {
        return recruitStatus(crewCount, recruitDeadlineAt, recruitmentCapacity, Instant.now());
    }

    /**
     * {@link #recruitStatus(long, Instant, Integer)} 와 같되 마감 판정에 {@code asOf} 를 쓴다 — 대시보드 집계 기준 시각.
     */
    public RecruitStatus recruitStatus(
            long crewCount, Instant recruitDeadlineAt, Integer recruitmentCapacity, Instant asOf) {
        if (status != StudyStatus.OPEN) {
            return null;
        }
        boolean deadlinePassed = recruitDeadlineAt != null && !asOf.isBefore(recruitDeadlineAt);
        boolean capacityReached = recruitmentCapacity != null && crewCount >= recruitmentCapacity;
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
            long crewCount, Instant recruitDeadlineAt, Integer recruitmentCapacity) {
        if (status == StudyStatus.DRAFT) {
            return null;
        }
        Instant now = Instant.now();
        if (isEnded(now)) {
            return StudyPhase.CLOSED;
        }
        if (startAt != null && !now.isBefore(startAt)) {
            return StudyPhase.ONGOING;
        }
        return recruitStatus(crewCount, recruitDeadlineAt, recruitmentCapacity)
                        == RecruitStatus.RECRUITING
                ? StudyPhase.RECRUITING
                : StudyPhase.CLOSED;
    }

    /**
     * 목록·필터가 쓰는 진행 시간대. 운영자가 고른 값({@code TIMEZONE})이 있으면 그대로 쓴다. 없으면(컬럼 전 데이터) 일정 문구({@code
     * SCHEDULE})의 표기로 판정한다 — PST·PDT 가 있으면 PST, KST 가 있으면 KST, 둘 다 없으면 두 지역 동시 모집이다.
     *
     * <p>목록 필터({@code StudyListJpqlDao.TIMEZONE})가 같은 순서로 판정한다 — 한쪽만 고치면 필터와 표시가 어긋난다.
     */
    public StudyTimezone timezone() {
        if (timezone != null) {
            return timezone;
        }
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

    /** 담당 캡틴인가 — {@code STUDY.OWNER_CAPTAIN_ID} 하나로 판정한다 (POL-0001). 비어 있으면 아무도 아니다. */
    public boolean isOwnedBy(Long accountId) {
        return ownerCaptainId != null && ownerCaptainId.equals(accountId);
    }

    /** 담당 캡틴을 바꾼다. 대상이 캡틴(ADMIN)인지는 호출하는 서비스가 계정을 잠그고 확인한다. */
    public void changeOwnerCaptain(Long accountId) {
        this.ownerCaptainId = accountId;
    }

    public boolean isPubliclyVisible() {
        return status != StudyStatus.DRAFT;
    }

    /**
     * 날짜까지 읽은 지금 상태. 저장된 {@code STATUS} 는 공개({@code DRAFT → OPEN})와 운영 종료({@code CLOSED})만 사람이 바꾸고
     * {@code OPEN → ONGOING → ENDED} 전환은 일으키지 않는다 (study-meeting 결정 5). 그래서 진행 중 · 종료는 {@code
     * START_AT} · {@code END_AT} 경과로 판정한다 — {@link #phase} 와 같은 날짜 규칙.
     *
     * <p>{@code DRAFT} · {@code CLOSED} 는 그대로, {@code ENDED} 이거나 {@code END_AT} 이 지났으면 {@code
     * ENDED}, {@code START_AT} 이 지났으면 {@code ONGOING}, 나머지는 저장된 값이다.
     *
     * <p>쿼리판은 {@link StudyLifecycleQuery} — 한쪽만 고치면 목록 필터와 판정이 어긋난다.
     */
    public StudyStatus statusAsOf(Instant asOf) {
        if (status == StudyStatus.DRAFT || status == StudyStatus.CLOSED) {
            return status;
        }
        if (status == StudyStatus.ENDED || (endAt != null && !asOf.isBefore(endAt))) {
            return StudyStatus.ENDED;
        }
        if (startAt != null && !asOf.isBefore(startAt)) {
            return StudyStatus.ONGOING;
        }
        return status;
    }

    /** 진행 중 — {@link #statusAsOf} 가 {@code ONGOING}. */
    public boolean isOngoing(Instant asOf) {
        return statusAsOf(asOf) == StudyStatus.ONGOING;
    }

    /**
     * 끝난 스터디 — 운영자가 끝냈거나({@code ENDED} · {@code CLOSED}) {@code END_AT} 이 지났다. 명부 · 공지를 더 바꾸지 않는다
     * (specs/study-participant/spec.md · specs/study-notice/spec.md).
     */
    public boolean isEnded(Instant asOf) {
        StudyStatus current = statusAsOf(asOf);
        return current == StudyStatus.ENDED || current == StudyStatus.CLOSED;
    }

    public boolean isEnded() {
        return isEnded(Instant.now());
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
