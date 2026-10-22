package com.studyclub.domain.participant;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
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
     * 신청 제출 = 명부 편입. 신청자는 그 스터디의 기본 반에 들어가고, 캡틴이 반을 나누면 「크루의 반 지정」으로 옮긴다
     * (docs/share/2026-10-18-roster-on-apply.md).
     */
    public static StudyParticipant joinByApplication(
            Long accountId, Long studyId, Long studyGroupId, Instant joinedAt) {
        return StudyParticipant.builder()
                .accountId(accountId)
                .studyId(studyId)
                .studyGroupId(studyGroupId)
                .status(ParticipantStatus.ACTIVE)
                .participantRole(ParticipantRole.MEMBER)
                .joinedAt(joinedAt)
                .build();
    }

    /**
     * 명부에서 빠졌던 사람이 같은 스터디에 다시 신청했다. 새 행을 만들면 그 사람의 옛 행과 반이 겹쳐 {@code UNIQUE(ACCOUNT_ID,
     * STUDY_GROUP_ID)} 에 걸리므로 옛 행을 되살린다. 반은 그대로, 역할은 크루로 돌린다 — 네비게이터는 캡틴이 다시 정한다.
     *
     * <p>{@code joinedAt} 을 다시 신청한 시각으로 옮긴다. 빠져 있던 동안의 회차가 출석률 분모에 결석으로 들어가지 않게 한다.
     */
    public void rejoinByApplication(Instant joinedAt) {
        this.status = ParticipantStatus.ACTIVE;
        this.participantRole = ParticipantRole.MEMBER;
        this.joinedAt = joinedAt;
        this.leftAt = null;
    }

    /**
     * 스터디 하차 — 명부에서 자발적으로 빠지는 경우. leftAt 을 기록해 AttendanceRateCalculator 가 이 시각 이전 회차만 집계에 포함하도록 한다.
     * leftAt 이후 회차는 결석(0점)이 아니라 분모에서 제외된다 — "하차"와 "결석"이 섞이지 않는다.
     */
    public void markWithdrawn(Instant withdrawnAt) {
        this.status = ParticipantStatus.WITHDRAWN;
        this.leftAt = withdrawnAt;
    }

    /**
     * 네비게이터·담당 캡틴이 출석부에서 참여를 중단시킨다 (specs/study-participant/spec.md). 이미 {@code WITHDRAWN} 이면 그대로
     * 둔다 — {@code leftAt} 을 덮어쓰면 집계 분모가 바뀐다. 완주·탈퇴한 행은 바꿀 수 없다.
     *
     * @return 이번에 바뀌었으면 true, 이미 중단된 행이면 false
     */
    public boolean withdraw(Instant now) {
        if (status == ParticipantStatus.WITHDRAWN) {
            return false;
        }
        if (status != ParticipantStatus.ACTIVE && status != ParticipantStatus.PAUSED) {
            throw new BusinessException(ErrorCode.PARTICIPANT_NOT_ACTIVE);
        }
        markWithdrawn(now);
        return true;
    }

    /**
     * 회원 탈퇴 — 명부 행을 지우지 않고 표시만 바꾼다. 행을 지우면 이미 쌓인 STUDY_ATTENDANCE(ACCOUNT_ID 로만 연결, FK 없음)가 갈 곳을 잃어
     * 집계에서 통째로 빠진다(specs/user-leave/spec.md). ACCOUNT_ID 는 그대로 둔다 — 참조할 ACCOUNT 행 자체가 없어져 더는 사람으로
     * 되짚을 수 없으므로 이 값 자체가 개인정보가 아니다(다른 탈퇴 보존 데이터와 같은 논리).
     *
     * <p>{@code leftAt} 이 이미 있으면(계정 탈퇴 전에 이미 WITHDRAWN 이었던 경우) 덮어쓰지 않는다 — 덮어쓰면 그 사이(하차~계정 탈퇴)에 열린
     * 회차까지 출석률 분모에 다시 들어와 집계가 오염된다.
     */
    public void markDeletedDueToAccountDeletion(Instant deletedAt) {
        this.status = ParticipantStatus.DELETED;
        if (this.leftAt == null) {
            this.leftAt = deletedAt;
        }
    }

    /** 스터디 역할을 바꾼다. ACTIVE·PAUSED 상태 검증은 서비스 레이어에서 한다. */
    public void changeRole(ParticipantRole role) {
        this.participantRole = role;
    }

    /** 소속 반을 옮긴다. ACTIVE·PAUSED 상태 검증·부수효과(발표자 정리·출석 생성)는 서비스 레이어에서 한다. */
    public void changeGroup(Long newGroupId) {
        this.studyGroupId = newGroupId;
    }
}
