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

@Entity
@Table(
    name = "STUDY_COHORT",
    indexes = @Index(name = "idx_study_cohort_study_status", columnList = "STUDY_ID, STATUS")
)
public class StudyCohort extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "STUDY_DELIVERY_FORMAT", nullable = false, length = 20)
    private DeliveryFormatEnum studyDeliveryFormatEnum;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudyCohortStatusEnum status;

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

    protected StudyCohort() {
    }

    public StudyCohort(Long studyId, DeliveryFormatEnum studyDeliveryFormatEnum, StudyCohortStatusEnum status,
                       String applicationForm, String curriculum, Integer capacity,
                       Instant recruitDeadline, Instant startDate, Instant endDate,
                       String discordChannelUrl, String driveUrl) {
        this.studyId = studyId;
        this.studyDeliveryFormatEnum = studyDeliveryFormatEnum;
        this.status = status;
        this.applicationForm = applicationForm;
        this.curriculum = curriculum;
        this.capacity = capacity;
        this.recruitDeadline = recruitDeadline;
        this.startDate = startDate;
        this.endDate = endDate;
        this.discordChannelUrl = discordChannelUrl;
        this.driveUrl = driveUrl;
    }

    public Long getId() { return id; }
    public Long getStudyId() { return studyId; }
    public DeliveryFormatEnum getStudyDeliveryFormatEnum() { return studyDeliveryFormatEnum; }
    public StudyCohortStatusEnum getStatus() { return status; }
    public String getApplicationForm() { return applicationForm; }
    public String getCurriculum() { return curriculum; }
    public Integer getCapacity() { return capacity; }
    public Instant getRecruitDeadline() { return recruitDeadline; }
    public Instant getStartDate() { return startDate; }
    public Instant getEndDate() { return endDate; }
    public String getDiscordChannelUrl() { return discordChannelUrl; }
    public String getDriveUrl() { return driveUrl; }
}
