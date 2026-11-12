package com.studyclub.domain.notice;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyNoticeRepository extends JpaRepository<StudyNotice, Long> {

    /** 이 반의 직전 발송 — 발송 한도(1분 간격)의 재료다. */
    Optional<StudyNotice> findFirstByStudyGroupIdOrderByCreatedAtDescIdDesc(Long studyGroupId);

    /** 이 반이 {@code since} 부터 보낸 수 — 하루 한도의 재료다. */
    long countByStudyGroupIdAndCreatedAtGreaterThanEqual(Long studyGroupId, Instant since);

    long countByStudyGroupId(Long studyGroupId);

    /** 회원 탈퇴 — 이 계정이 보낸 공지의 ID. 받은 사람들의 메일 행에서 보낸 사람 이름을 비식별화할 때 쓴다. */
    @Query("SELECT n.id FROM StudyNotice n WHERE n.senderAccountId = :senderAccountId")
    List<Long> findIdsBySenderAccountId(@Param("senderAccountId") Long senderAccountId);

    /**
     * 스터디를 지울 때 — 받는 사람 행까지 함께 지운다. 일괄 삭제 문(DELETE ... WHERE)으로 지운다.
     *
     * <p>파생 삭제({@code deleteBy...})는 대상을 일반 SELECT 로 먼저 읽고 그 행만 기본키로 지우는데, MySQL REPEATABLE READ 에서
     * 일반 SELECT 는 트랜잭션의 첫 일반 조회 때 고정된 스냅샷을 읽는다. 그래서 삭제가 반 락을 기다리는 동안 진행 중인 발송이 커밋한 공지는 대상에서 빠져 스터디가
     * 사라진 뒤에도 남았다. DELETE 문은 지금 커밋된 최신 행을 읽으므로 그 공지도 함께 지운다. H2(READ COMMITTED)에서는 이 차이가 드러나지 않는다.
     */
    default void deleteByStudyId(Long studyId) {
        deleteRecipientsByStudyId(studyId);
        deleteNoticesByStudyId(studyId);
    }

    /** 받는 사람 행은 공지 엔티티가 {@code @JoinColumn} 으로만 가져 JPQL 로 가리킬 수 없어 네이티브로 지운다. 공지보다 먼저 지운다. */
    @Modifying
    @Query(
            value =
                    "DELETE FROM STUDY_NOTICE_RECIPIENT WHERE NOTICE_ID IN"
                            + " (SELECT ID FROM STUDY_NOTICE WHERE STUDY_ID = :studyId)",
            nativeQuery = true)
    void deleteRecipientsByStudyId(@Param("studyId") Long studyId);

    @Modifying
    @Query("DELETE FROM StudyNotice n WHERE n.studyId = :studyId")
    void deleteNoticesByStudyId(@Param("studyId") Long studyId);

    /** 보낸 공지 기록 — 최근 순. 같은 시각이어도 순서가 흔들리지 않게 ID 를 보조 키로 쓴다. */
    @Query(
            "SELECT n FROM StudyNotice n WHERE n.studyGroupId = :studyGroupId"
                    + " ORDER BY n.createdAt DESC, n.id DESC LIMIT :limit OFFSET :offset")
    List<StudyNotice> findPage(
            @Param("studyGroupId") Long studyGroupId,
            @Param("limit") int limit,
            @Param("offset") int offset);

    /** 기록 목록의 받는 사람 수·멘션 수를 한 번에 센다 (공지마다 조회하지 않는다 — N+1). */
    @Query(
            "SELECT n.id AS noticeId, COUNT(r) AS total,"
                    + " COALESCE(SUM(CASE WHEN r.discordMentioned = true THEN 1 ELSE 0 END), 0)"
                    + " AS mentioned"
                    + " FROM StudyNotice n JOIN n.recipients r WHERE n.id IN :ids GROUP BY n.id")
    List<RecipientCount> countRecipients(@Param("ids") Collection<Long> ids);

    interface RecipientCount {
        Long getNoticeId();

        long getTotal();

        long getMentioned();
    }
}
