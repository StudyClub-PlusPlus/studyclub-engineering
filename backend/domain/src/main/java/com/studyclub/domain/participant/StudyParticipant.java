package com.studyclub.domain.participant;

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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "STUDY_PARTICIPANT",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_study_participant_account_group",
                        columnNames = {"ACCOUNT_ID", "STUDY_GROUP_ID"}),
        indexes = {
            @Index(name = "idx_study_participant_account", columnList = "ACCOUNT_ID"),
            @Index(
                    name = "idx_study_participant_group_status",
                    columnList = "STUDY_GROUP_ID, STATUS"),
            @Index(name = "idx_study_participant_study_status", columnList = "STUDY_ID, STATUS")
        })
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudyParticipant extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "STUDY_GROUP_ID", nullable = false)
    private Long studyGroupId;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ParticipantStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "PARTICIPANT_ROLE", nullable = false, length = 20)
    private ParticipantRole participantRole;

    @Column(name = "JOINED_AT", nullable = false)
    private Instant joinedAt;

    /**
     * 참여가 끝난 시각 — WITHDRAWN·DELETED 일 때만 값이 있다. ACTIVE/PAUSED/COMPLETED 동안은 null.
     *
     * <p>출석률 집계(AttendanceRateCalculator)가 이 시각까지의 회차만 분모에 넣는다 — 그 이후 회차를 결석(0점)으로 깔면 "하차"와 "결석"이라는
     * 서로 다른 사실이 같은 숫자로 섞인다(specs/user-leave/spec.md).
     */
    @Column(name = "LEFT_AT")
    private Instant leftAt;

    /**
     * 회원 탈퇴 — 명부 행을 지우지 않고 표시만 바꾼다. 행을 지우면 이미 쌓인 STUDY_ATTENDANCE(ACCOUNT_ID 로만 연결, FK 없음)가 갈 곳을 잃어
     * 집계에서 통째로 빠진다(specs/user-leave/spec.md). ACCOUNT_ID 는 그대로 둔다 — 참조할 ACCOUNT 행 자체가 없어져 더는 사람으로
     * 되짚을 수 없으므로 이 값 자체가 개인정보가 아니다(다른 탈퇴 보존 데이터와 같은 논리).
     */
    public void markDeletedDueToAccountDeletion(Instant deletedAt) {
        this.status = ParticipantStatus.DELETED;
        this.leftAt = deletedAt;
    }
}
