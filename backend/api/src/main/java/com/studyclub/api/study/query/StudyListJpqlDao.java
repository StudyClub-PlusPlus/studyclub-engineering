package com.studyclub.api.study.query;

import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyPhase;
import com.studyclub.domain.study.StudyTimezone;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Repository;

/**
 * {@link StudyListDao} 의 JPQL 구현.
 *
 * <p>조건의 <b>뜻</b>은 도메인이 갖는다 — 단계는 {@link Study#phase}, 시간대는 {@link Study#timezone}, 정원 판정은 {@link
 * Study#recruitStatus} 다. 여기 있는 식은 <b>같은 규칙을 DB 에서 한 번 더</b> 쓴 것이다. 페이지네이션 때문에 필터·정렬이 DB 에서 일어나야 해서
 * 생긴 중복이라, 한쪽을 고치면 다른 쪽도 고친다 — {@code StudyListIntegrationTest} 가 {@code status} 필터 결과와 응답 {@code
 * phase} 를 함께 검증한다.
 */
@Repository
class StudyListJpqlDao implements StudyListDao {

    private static final List<ParticipantStatus> OCCUPYING =
            List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED);

    /** 현재 모집 마감 시각 — 가장 최근(id 최대) 회차의 값. 없으면 null(상시 모집). */
    private static final String CURRENT_DEADLINE =
            "(SELECT r.recruitDeadlineAt FROM StudyRecruitment r WHERE r.id ="
                    + " (SELECT MAX(r2.id) FROM StudyRecruitment r2 WHERE r2.studyId = s.id))";

    /** 정원을 차지하는 참여자 수 — ACTIVE·PAUSED 만. */
    private static final String OCCUPYING_COUNT =
            "(SELECT COUNT(p) FROM StudyParticipant p WHERE p.studyId = s.id"
                    + " AND p.status IN :occupying)";

    /** 단계 등수 — 0 모집 중 · 1 진행 중 · 2 종료. {@link StudyPhase} 선언 순서와 같다. */
    private static final String PHASE_RANK =
            "CASE"
                    + " WHEN s.status = com.studyclub.domain.study.StudyStatus.CLOSED"
                    + "   OR (s.endAt IS NOT NULL AND s.endAt <= :now) THEN 2"
                    + " WHEN s.startAt IS NOT NULL AND s.startAt <= :now THEN 1"
                    + " WHEN ("
                    + CURRENT_DEADLINE
                    + " IS NULL OR "
                    + CURRENT_DEADLINE
                    + " > :now)"
                    + "   AND (s.capacity IS NULL OR "
                    + OCCUPYING_COUNT
                    + " < s.capacity) THEN 0"
                    + " ELSE 2 END";

    private static final String TIMEZONE =
            "CASE"
                    + " WHEN UPPER(s.schedule) LIKE '%PST%' OR UPPER(s.schedule) LIKE '%PDT%'"
                    + "   THEN 'PST'"
                    + " WHEN UPPER(s.schedule) LIKE '%KST%' THEN 'KST'"
                    + " ELSE 'BOTH' END";

    /** 공개 대상 — 숨김·작성 중(DRAFT)은 빼고, 프로그램마다 가장 최근 기수 1건만. */
    private static final String VISIBLE =
            " WHERE s.isHidden = false"
                    + " AND s.status <> com.studyclub.domain.study.StudyStatus.DRAFT"
                    + " AND s.id = (SELECT MAX(s2.id) FROM Study s2 WHERE s2.programId = s.programId"
                    + "   AND s2.isHidden = false"
                    + "   AND s2.status <> com.studyclub.domain.study.StudyStatus.DRAFT)";

    /** 값이 없는 조건은 걸리지 않는다. */
    private static final String FILTERS =
            " AND (:category IS NULL OR s.category = :category)"
                    + " AND (:keyword IS NULL OR LOWER(s.title) LIKE :keyword"
                    + "   OR LOWER(s.oneLineSummary) LIKE :keyword)"
                    + " AND (:timezone IS NULL OR "
                    + TIMEZONE
                    + " = :timezone)"
                    + " AND (:phaseRank IS NULL OR "
                    + PHASE_RANK
                    + " = :phaseRank)"
                    // 종료 임박 — 지금 신청할 수 있는 스터디 중에서만 고른다
                    + " AND (:deadlineBefore IS NULL OR ("
                    + PHASE_RANK
                    + " = 0 AND "
                    + CURRENT_DEADLINE
                    + " IS NOT NULL AND "
                    + CURRENT_DEADLINE
                    + " < :deadlineBefore))";

    /** 모집 중 → 진행 중 → 종료, 같은 단계에서는 최근 등록 순. 사용자가 고르는 정렬은 없다. */
    private static final String SEARCH =
            "SELECT s FROM Study s"
                    + VISIBLE
                    + FILTERS
                    + " ORDER BY "
                    + PHASE_RANK
                    + " ASC, s.id DESC";

    private static final String COUNT = "SELECT COUNT(s) FROM Study s" + VISIBLE + FILTERS;

    @PersistenceContext private EntityManager em;

    @Override
    public List<Study> search(StudyListFilter filter, int offset, int limit) {
        return bind(em.createQuery(SEARCH, Study.class), filter)
                .setFirstResult(Math.max(offset, 0))
                .setMaxResults(limit)
                .getResultList();
    }

    @Override
    public long count(StudyListFilter filter) {
        return bind(em.createQuery(COUNT, Long.class), filter).getSingleResult();
    }

    private <T> TypedQuery<T> bind(TypedQuery<T> query, StudyListFilter filter) {
        return query.setParameter("now", Instant.now())
                .setParameter("occupying", OCCUPYING)
                .setParameter("category", filter.category())
                .setParameter("keyword", likePattern(filter.keyword()))
                .setParameter("timezone", name(filter.timezone()))
                .setParameter("phaseRank", rank(filter.phase()))
                .setParameter("deadlineBefore", filter.recruitDeadlineBefore());
    }

    private static String likePattern(String keyword) {
        return (keyword == null || keyword.isBlank())
                ? null
                : "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
    }

    private static String name(StudyTimezone timezone) {
        return timezone == null ? null : timezone.name();
    }

    private static Integer rank(StudyPhase phase) {
        return phase == null ? null : phase.ordinal();
    }
}
