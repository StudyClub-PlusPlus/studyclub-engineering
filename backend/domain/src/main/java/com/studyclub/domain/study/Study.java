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
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.regex.Pattern;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "STUDY",
        uniqueConstraints = @UniqueConstraint(name = "uk_study_slug", columnNames = "SLUG"),
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

    @Column(nullable = false, unique = true, length = 100)
    private String slug;

    @Column(name = "ONE_LINE_SUMMARY", nullable = false, length = 255)
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

    @Enumerated(EnumType.STRING)
    @Column(name = "STUDY_DELIVERY_FORMAT", nullable = false, length = 20)
    private DeliveryFormat studyDeliveryFormat;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudyStatus status;

    @Column(name = "APPLICATION_FORM", columnDefinition = "json")
    private String applicationForm;

    @Column(columnDefinition = "json")
    private String curriculum;

    private Integer capacity;

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

    public boolean isClosingSoon(Instant recruitDeadlineAt) {
        return status == StudyStatus.OPEN
                && recruitDeadlineAt != null
                && recruitDeadlineAt.isBefore(
                        Instant.now().plus(CLOSING_SOON_DAYS, ChronoUnit.DAYS));
    }

    /**
     * 모집 상태를 계산한다. {@code STATUS = OPEN} 일 때만 의미가 있어 그 밖에서는 {@code null} 을 돌려준다 — 모집 상태가 "없는" 것이지
     * 마감된 것이 아니다.
     *
     * <p>{@code recruitDeadlineAt == null} 은 상시 모집이라 시각으로는 마감되지 않고, {@code capacity == null} 은
     * 무제한이라 정원으로도 마감되지 않는다.
     *
     * <p>참여자 수는 STUDY_PARTICIPANT 애그리거트 소관이라 밖에서 받는다. 정원을 차지하는 참여자(ACTIVE·PAUSED)만 세야 하므로 {@code
     * StudyParticipantRepository.countByStudyIds} 가 주는 값을 그대로 넘긴다.
     *
     * <p>{@code recruitDeadlineAt} 은 STUDY_RECRUITMENT 에서 가져온 계획된 마감 시각이다.
     */
    public RecruitStatus recruitStatus(long applicantCount, Instant recruitDeadlineAt) {
        if (status != StudyStatus.OPEN) {
            return null;
        }
        boolean deadlinePassed =
                recruitDeadlineAt != null && !Instant.now().isBefore(recruitDeadlineAt);
        boolean capacityReached = capacity != null && applicantCount >= capacity;
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
    public StudyPhase phase(long applicantCount, Instant recruitDeadlineAt) {
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
        return recruitStatus(applicantCount, recruitDeadlineAt) == RecruitStatus.RECRUITING
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
        return status == StudyStatus.OPEN && !isHidden;
    }

    public void replaceApplicationForm(String applicationForm) {
        this.applicationForm = applicationForm;
    }
}
