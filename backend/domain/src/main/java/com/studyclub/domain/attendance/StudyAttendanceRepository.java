package com.studyclub.domain.attendance;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyAttendanceRepository extends JpaRepository<StudyAttendance, Long> {

    /** 미팅 목록에 속하는 모든 출석 레코드. uk_study_attendance_meeting_account 인덱스 활용. */
    List<StudyAttendance> findByStudyMeetingIdIn(Collection<Long> studyMeetingIds);

    Optional<StudyAttendance> findByStudyMeetingIdAndAccountId(Long studyMeetingId, Long accountId);

    /**
     * 출석을 한 문장으로 찍는다 — 없으면 PRESENT 로 만들고, 있으면 ABSENT 일 때만 PRESENT 로 올린다.
     *
     * <p>조회 후 저장으로 나누면 두 곳이 깨진다. (1) MySQL REPEATABLE READ 에서 비잠금 조회는 트랜잭션 최초 스냅샷을 재사용하므로, 겹쳐 들어온
     * 요청이 서로의 INSERT 를 못 보고 {@code uk_study_attendance_meeting_account} 위반으로 500 이 된다. (2) 읽은 뒤
     * 화면에서 EXCUSED 로 고치면 그 값을 덮어쓴다. 판정을 DB 한 문장 안에 두면 둘 다 사라진다.
     *
     * <p>{@code UPDATED_AT} 을 먼저 쓰는 건 일부러다 — MySQL 은 ON DUPLICATE KEY UPDATE 의 대입을 왼쪽부터 평가하므로,
     * STATUS 를 먼저 바꾸면 뒤따르는 조건이 이미 바뀐 값을 본다.
     *
     * @return 실제로 INSERT 나 UPDATE 가 일어났으면 1 이상
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            value =
                    """
                    INSERT INTO STUDY_ATTENDANCE
                        (ACCOUNT_ID, STUDY_ID, STUDY_GROUP_ID, STUDY_MEETING_ID, STATUS, CREATED_AT, UPDATED_AT)
                    VALUES (:accountId, :studyId, :studyGroupId, :studyMeetingId, 'PRESENT', :now, :now)
                    ON DUPLICATE KEY UPDATE
                        UPDATED_AT = CASE WHEN STATUS = 'ABSENT' THEN :now ELSE UPDATED_AT END,
                        STATUS = CASE WHEN STATUS = 'ABSENT' THEN 'PRESENT' ELSE STATUS END
                    """,
            nativeQuery = true)
    int markPresent(
            @Param("accountId") Long accountId,
            @Param("studyId") Long studyId,
            @Param("studyGroupId") Long studyGroupId,
            @Param("studyMeetingId") Long studyMeetingId,
            @Param("now") Instant now);

    /** 스터디 내 특정 계정들의 전체 출석 이력. idx_study_attendance_study_account 인덱스 활용. */
    List<StudyAttendance> findByStudyIdAndAccountIdIn(Long studyId, Collection<Long> accountIds);

    /** 한 계정의 여러 스터디 출석. idx_study_attendance_account_study 인덱스 활용. */
    List<StudyAttendance> findByAccountIdAndStudyIdIn(Long accountId, Collection<Long> studyIds);

    void deleteByStudyId(Long studyId);

    void deleteByStudyMeetingId(Long studyMeetingId);
}
