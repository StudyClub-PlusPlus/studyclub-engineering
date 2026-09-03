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
    uniqueConstraints = @UniqueConstraint(name = "uk_study_attendance_meeting_user", columnNames = {"STUDY_MEETING_ID", "USER_ID"}),
    indexes = {
        @Index(name = "idx_study_attendance_user_cohort", columnList = "USER_ID, STUDY_COHORT_ID"),
        @Index(name = "idx_study_attendance_user_class", columnList = "USER_ID, STUDY_CLASS_ID"),
        @Index(name = "idx_study_attendance_meeting", columnList = "STUDY_MEETING_ID")
    }
)
public class StudyAttendance extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "USER_ID", nullable = false)
    private Long userId;

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

    public StudyAttendance(Long userId, Long studyCohortId, Long studyClassId,
                           Long studyMeetingId, AttendanceStatusEnum status) {
        this.userId = userId;
        this.studyCohortId = studyCohortId;
        this.studyClassId = studyClassId;
        this.studyMeetingId = studyMeetingId;
        this.status = status;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getStudyCohortId() { return studyCohortId; }
    public Long getStudyClassId() { return studyClassId; }
    public Long getStudyMeetingId() { return studyMeetingId; }
    public AttendanceStatusEnum getStatus() { return status; }
}
