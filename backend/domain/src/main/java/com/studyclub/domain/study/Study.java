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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

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

    @Column(name = "RECRUIT_DEADLINE")
    private Instant recruitDeadline;

    @Column(name = "START_DATE")
    private Instant startDate;

    @Column(name = "END_DATE")
    private Instant endDate;

    @Column(name = "DISCORD_CHANNEL_URL", length = 2048)
    private String discordChannelUrl;

    @Column(name = "DRIVE_URL", length = 2048)
    private String driveUrl;

    @Column(length = 255)
    private String schedule;

    @Column(name = "PUBLISH_DATE")
    private Instant publishDate;

    private static final long CLOSING_SOON_DAYS = 3;

    public boolean isClosingSoon() {
        return status == StudyStatus.OPEN
                && recruitDeadline != null
                && recruitDeadline.isBefore(Instant.now().plus(CLOSING_SOON_DAYS, ChronoUnit.DAYS));
    }

    /**
     * 모집 상태를 계산한다. {@code STATUS = OPEN} 일 때만 의미가 있어 그 밖에서는 {@code null} 을 돌려준다 — 모집 상태가 "없는" 것이지
     * 마감된 것이 아니다.
     *
     * <p>{@code recruitDeadline == null} 은 상시 모집이라 시각으로는 마감되지 않고, {@code capacity == null} 은 무제한이라
     * 정원으로도 마감되지 않는다.
     *
     * <p>참여자 수는 STUDY_PARTICIPANT 애그리거트 소관이라 밖에서 받는다. 정원을 차지하는 참여자(ACTIVE·PAUSED)만 세야 하므로 {@code
     * StudyParticipantRepository.countByCohortIds} 가 주는 값을 그대로 넘긴다.
     */
    public RecruitStatus recruitStatus(long applicantCount) {
        if (status != StudyStatus.OPEN) {
            return null;
        }
        boolean deadlinePassed =
                recruitDeadline != null && !Instant.now().isBefore(recruitDeadline);
        boolean capacityReached = capacity != null && applicantCount >= capacity;
        return (deadlinePassed || capacityReached)
                ? RecruitStatus.RECRUIT_CLOSED
                : RecruitStatus.RECRUITING;
    }
}
