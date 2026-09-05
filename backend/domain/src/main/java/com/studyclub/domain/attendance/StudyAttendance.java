package com.studyclub.domain.attendance;

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

@Entity
@Table(
    name = "STUDY_ATTENDANCE",
    uniqueConstraints = @UniqueConstraint(name = "uk_study_attendance_meeting_account", columnNames = {"STUDY_MEETING_ID", "ACCOUNT_ID"}),
    indexes = {
        @Index(name = "idx_study_attendance_account_cohort", columnList = "ACCOUNT_ID, STUDY_COHORT_ID"),
        @Index(name = "idx_study_attendance_account_class", columnList = "ACCOUNT_ID, STUDY_CLASS_ID"),
        @Index(name = "idx_study_attendance_cohort_status", columnList = "STUDY_COHORT_ID, STATUS")
    }
)
public class StudyAttendance extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "STUDY_COHORT_ID", nullable = false)
    private Long studyCohortId;

    @Column(name = "STUDY_CLASS_ID", nullable = false)
    private Long studyClassId;

    @Column(name = "STUDY_MEETING_ID", nullable = false)
    private Long studyMeetingId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AttendanceStatusEnum status;

    protected StudyAttendance() {
    }

    public StudyAttendance(Long accountId, Long studyCohortId, Long studyClassId,
                           Long studyMeetingId, AttendanceStatusEnum status) {
        this.accountId = userId;
        this.studyCohortId = studyCohortId;
        this.studyClassId = studyClassId;
        this.studyMeetingId = studyMeetingId;
        this.status = status;
    }

    public Long getId() { return id; }
    public Long getAccountId() { return userId; }
    public Long getStudyCohortId() { return studyCohortId; }
    public Long getStudyClassId() { return studyClassId; }
    public Long getStudyMeetingId() { return studyMeetingId; }
    public AttendanceStatusEnum getStatus() { return status; }
}
