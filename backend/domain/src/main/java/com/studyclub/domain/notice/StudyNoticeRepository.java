package com.studyclub.domain.notice;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyNoticeRepository extends JpaRepository<StudyNotice, Long> {

    /** 이 반의 직전 발송 — 발송 한도(1분 간격)의 재료다. */
    Optional<StudyNotice> findFirstByStudyGroupIdOrderByCreatedAtDescIdDesc(Long studyGroupId);

    /** 이 반이 {@code since} 부터 보낸 수 — 하루 한도의 재료다. */
    long countByStudyGroupIdAndCreatedAtGreaterThanEqual(Long studyGroupId, Instant since);

    long countByStudyGroupId(Long studyGroupId);

    /** 스터디를 지울 때 — 받는 사람 행까지 함께 지운다. */
    void deleteByStudyId(Long studyId);

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
