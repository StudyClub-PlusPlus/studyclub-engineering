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

    // ponytail: docs/erd/STUDY.md 는 SLUG 를 두지 않는다 — 주소는 STUDY.ID 다. 지금은 core-front 가 이 값을
    // 공개 상세 주소로 쓰고 있어 같이 걷어내야 하고, 그러면 사용자에게 보이는 URL 이 바뀐다. 별도 작업으로 뺀다
    @Column(nullable = false, unique = true, length = 100)
    private String slug;

    @Column(name = "ONE_LINE_SUMMARY", nullable = false, length = 255)
    private String oneLineSummary;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private StudyCategory category;

    // ponytail: STUDY.md 기준 STUDY_KIND 는 STUDY_PROGRAM 소속이다(기수마다 다를 수 없다). 응답·프론트가
    // 이 값을 읽고 있어 프로그램 쪽으로 옮기는 건 별도 작업으로 둔다
    @Enumerated(EnumType.STRING)
    @Column(name = "STUDY_KIND", nullable = false, length = 20)
    private StudyKind studyKind;

    @Column(name = "THUMBNAIL_URL", length = 2048)
    private String thumbnailUrl;

    // ponytail: STUDY.md 에 없는 컬럼이다. 응답·프론트가 읽고 있어 제거는 별도 작업으로 둔다
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

    /** 이 기수를 등록한 계정 ID. ACCOUNT 참조(인덱스만, 외래키 없음 — 애그리거트 밖). NULL = 이 컬럼이 생기기 전 데이터. */
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

    public void changeDriveUrl(String driveUrl) {
        this.driveUrl = blankToNull(driveUrl);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
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
     * <p>{@code recruitDeadlineAt == null} 은 시각으로 마감되지 않고, {@code recruitmentCapacity == null} 은
     * 무제한이라 정원으로도 마감되지 않는다.
     *
     * <p>마감 시각과 정원은 둘 다 STUDY_RECRUITMENT(모집 회차) 소관이라 밖에서 받는다 — docs/erd/STUDY.md 는 정원을 STUDY 에 두지
     * 않는다. 참여자 수도 STUDY_PARTICIPANT 애그리거트 소관이라, 정원을 차지하는 참여자(ACTIVE·PAUSED)만 세는 {@code
     * StudyParticipantRepository.countByStudyIds} 가 주는 값을 그대로 넘긴다.
     */
    public RecruitStatus recruitStatus(
            long applicantCount, Instant recruitDeadlineAt, Integer recruitmentCapacity) {
        if (status != StudyStatus.OPEN) {
            return null;
        }
        boolean deadlinePassed =
                recruitDeadlineAt != null && !Instant.now().isBefore(recruitDeadlineAt);
        boolean capacityReached =
                recruitmentCapacity != null && applicantCount >= recruitmentCapacity;
        return (deadlinePassed || capacityReached)
                ? RecruitStatus.RECRUIT_CLOSED
                : RecruitStatus.RECRUITING;
    }

    /**
     * 목록 탭 단계를 계산한다. {@code DRAFT} 는 공개 목록에 나오지 않아 {@code null} 이다.
     *
     * <p><b>{@code STATUS} 하나만 읽는다</b> — docs/erd/STUDY.md 「사용자 사이트 표기」. {@code START_AT} / {@code
     * END_AT} 은 화면에 보이는 값일 뿐 상태를 바꾸지 않으므로 여기서도 보지 않는다. 날짜를 같이 보던 이전 구현은 {@code START_AT} 이 비어 있는
     * {@code ONGOING} 기수를 종료로 내보냈다.
     *
     * <p>{@code OPEN} 안에서 모집 중·마감을 다시 가르는 건 {@link #recruitStatus} 쪽이다 — 이 메서드는 "어디까지 진행됐는가"만 말한다.
     */
    public StudyPhase phase() {
        return switch (status) {
            case DRAFT -> null;
            case OPEN -> StudyPhase.RECRUITING;
            case ONGOING -> StudyPhase.ONGOING;
            case ENDED, CLOSED -> StudyPhase.CLOSED;
        };
    }

    /**
     * 진행 시간대를 일정 문구({@code SCHEDULE})의 표기로 판정한다. PST·PDT 가 있으면 PST, KST 가 있으면 KST, 둘 다 없으면 두 지역 동시
     * 모집이다.
     */
    // ponytail: 자유 텍스트 판정 — 표기가 흔들리면 틀린다. STUDY.md 는 TIMEZONE 컬럼을 두기로 했다(등록 폼에서 직접 고른다).
    // 컬럼 추가는 등록·수정 폼까지 걸려 별도 작업으로 둔다
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

    /**
     * 공개 여부 — {@code DRAFT} 만 비공개다. docs/erd/STUDY.md 「공개 여부」: 판정은 {@code STATUS != DRAFT} 하나이고 별도
     * 숨김 플래그는 두지 않는다. {@code OPEN} 만 공개로 보던 이전 구현은 진행 중·종료된 기수를 비공개로 취급했다.
     */
    public boolean isPubliclyVisible() {
        return status != StudyStatus.DRAFT;
    }

    public void replaceApplicationForm(String applicationForm) {
        this.applicationForm = applicationForm;
    }
}
