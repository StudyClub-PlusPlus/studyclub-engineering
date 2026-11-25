package com.studyclub.domain.participant;

import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 명부 행의 반이 바뀐 일 한 줄 (docs/erd/STUDY_PARTICIPANT_GROUP_MOVE.md). 고치거나 지우는 API 는 없고, 스터디 삭제만 함께 지운다.
 *
 * <p>반 이름은 옮긴 그때 값을 복사한다 — 반을 지워도 「A반에서 이동」을 보여 줘야 해서 반에 FK 를 걸지 않는다.
 */
@Entity
@Table(
        name = "STUDY_PARTICIPANT_GROUP_MOVE",
        indexes = {
            @Index(
                    name = "idx_study_participant_group_move_participant_moved",
                    columnList = "PARTICIPANT_ID, MOVED_AT"),
            @Index(
                    name = "idx_study_participant_group_move_from_group_moved",
                    columnList = "FROM_GROUP_ID, MOVED_AT"),
            @Index(
                    name = "idx_study_participant_group_move_study_moved",
                    columnList = "STUDY_ID, MOVED_AT")
        })
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StudyParticipantGroupMove extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    @Column(name = "PARTICIPANT_ID", nullable = false)
    private Long participantId;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "FROM_GROUP_ID")
    private Long fromGroupId;

    @Column(name = "FROM_GROUP_NAME", length = 255)
    private String fromGroupName;

    @Column(name = "TO_GROUP_ID")
    private Long toGroupId;

    @Column(name = "TO_GROUP_NAME", length = 255)
    private String toGroupName;

    @Column(name = "MOVED_BY_ACCOUNT_ID", nullable = false)
    private Long movedByAccountId;

    @Column(name = "MOVED_AT", nullable = false)
    private Instant movedAt;

    /**
     * {@code from} · {@code to} 는 이동 트랜잭션이 잠근 반 행이어야 한다. 반 제목 수정도 반 행을 잠그므로, 잠근 행에서 읽어야 동시에 바뀐 제목과
     * 엇갈리지 않는다. 반이 없던 쪽은 null.
     */
    public static StudyParticipantGroupMove of(
            StudyParticipant participant,
            StudyGroup from,
            StudyGroup to,
            Long movedByAccountId,
            Instant movedAt) {
        StudyParticipantGroupMove move = new StudyParticipantGroupMove();
        move.studyId = participant.getStudyId();
        move.participantId = participant.getId();
        move.accountId = participant.getAccountId();
        move.fromGroupId = from == null ? null : from.getId();
        move.fromGroupName = from == null ? null : from.getName();
        move.toGroupId = to == null ? null : to.getId();
        move.toGroupName = to == null ? null : to.getName();
        move.movedByAccountId = movedByAccountId;
        move.movedAt = movedAt;
        return move;
    }
}
