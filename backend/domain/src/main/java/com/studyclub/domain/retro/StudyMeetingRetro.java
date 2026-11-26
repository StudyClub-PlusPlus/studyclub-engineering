package com.studyclub.domain.retro;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "STUDY_MEETING_RETRO",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_retro_meeting_participant",
                        columnNames = {"MEETING_ID", "PARTICIPANT_ID"}),
        indexes = @Index(name = "idx_retro_meeting", columnList = "MEETING_ID"))
public class StudyMeetingRetro extends BaseEntity {

    public static final int MAX_LENGTH = 500;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 다른 애그리거트라 FK 없이 ID 참조
    @Column(name = "MEETING_ID", nullable = false)
    private Long meetingId;

    // 다른 애그리거트라 FK 없이 ID 참조
    @Column(name = "PARTICIPANT_ID", nullable = false)
    private Long participantId;

    @Column(name = "GOOD", nullable = false, length = MAX_LENGTH)
    private String good;

    @Column(name = "IMPROVE", nullable = false, length = MAX_LENGTH)
    private String improve;

    // 선택 항목 — 빈 문자열이면 남기지 않은 것. DEFAULT '' 는 Flyway DDL 과 맞춘다
    @Column(
            name = "FEELING",
            nullable = false,
            length = MAX_LENGTH,
            columnDefinition = "VARCHAR(500) NOT NULL DEFAULT ''")
    private String feeling;

    protected StudyMeetingRetro() {}

    public static StudyMeetingRetro write(
            Long meetingId, Long participantId, String good, String improve, String feeling) {
        StudyMeetingRetro retro = new StudyMeetingRetro();
        retro.meetingId = meetingId;
        retro.participantId = participantId;
        retro.good = good;
        retro.improve = improve;
        retro.feeling = feeling != null ? feeling : "";
        return retro;
    }

    /** 고쳐도 받은 공감은 남는다 — 공감은 STUDY_MEETING_RETRO_LIKE 가 별도로 가진다. */
    public void update(String good, String improve, String feeling) {
        this.good = good;
        this.improve = improve;
        this.feeling = feeling != null ? feeling : "";
    }

    public Long getId() {
        return id;
    }

    public Long getMeetingId() {
        return meetingId;
    }

    public Long getParticipantId() {
        return participantId;
    }

    public String getGood() {
        return good;
    }

    public String getImprove() {
        return improve;
    }

    public String getFeeling() {
        return feeling;
    }
}
