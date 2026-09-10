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
        name = "STUDY_COHORT",
        indexes = @Index(name = "idx_study_cohort_study_status", columnList = "STUDY_ID, STATUS"))
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudyCohort extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "STUDY_DELIVERY_FORMAT", nullable = false, length = 20)
    private DeliveryFormat studyDeliveryFormat;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudyCohortStatus status;

    @Column(name = "APPLICATION_FORM", columnDefinition = "json")
    private String applicationForm;

    @Column(columnDefinition = "json")
    private String curriculum;

    private Integer capacity;

    @Column(name = "RECRUIT_DEADLINE", nullable = false)
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
        return status == StudyCohortStatus.OPEN
                && recruitDeadline != null
                && recruitDeadline.isBefore(Instant.now().plus(CLOSING_SOON_DAYS, ChronoUnit.DAYS));
    }
}
