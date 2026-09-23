package com.studyclub.domain.study;

import com.studyclub.domain.participant.ParticipantStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

public class StudyListQueryRepositoryImpl implements StudyListQueryRepository {

    /** 가장 최근 모집 회차의 마감 시각. 없으면 null(상시 모집). */
    private static final String DEADLINE =
            "(SELECT r.recruitDeadlineAt FROM StudyRecruitment r WHERE r.id ="
                    + " (SELECT MAX(r2.id) FROM StudyRecruitment r2 WHERE r2.studyId = s.id))";

    /** 정원을 차지하는 참여자 수 (ACTIVE + PAUSED). */
    private static final String OCCUPYING =
            "(SELECT COUNT(p) FROM StudyParticipant p WHERE p.studyId = s.id"
                    + " AND p.status IN :occupying)";

    /**
     * 목록 탭 단계를 등수로 환산한다 — 0 모집 중 · 1 진행 중 · 2 종료. 필터와 정렬이 같은 식을 쓴다.
     *
     * <p>판정 순서는 {@link Study#phase} 와 같아야 한다. 어긋나면 목록의 필터 결과와 카드에 찍힌 phase 가 달라진다 —
     * StudyListIntegrationTest 가 두 값을 함께 검증한다.
     */
    private static final String PHASE_RANK =
            "CASE"
                    + " WHEN s.status = com.studyclub.domain.study.StudyStatus.CLOSED"
                    + "   OR (s.endAt IS NOT NULL AND s.endAt <= :now) THEN 2"
                    + " WHEN s.startAt IS NOT NULL AND s.startAt <= :now THEN 1"
                    + " WHEN ("
                    + DEADLINE
                    + " IS NULL OR "
                    + DEADLINE
                    + " > :now)"
                    + "   AND (s.capacity IS NULL OR "
                    + OCCUPYING
                    + " < s.capacity) THEN 0"
                    + " ELSE 2 END";

    /** 진행 시간대 — 일정 문구의 표기로 판정한다. {@link Study#timezone} 과 같은 규칙. */
    private static final String TIMEZONE =
            "CASE"
                    + " WHEN UPPER(s.schedule) LIKE '%PST%' OR UPPER(s.schedule) LIKE '%PDT%'"
                    + "   THEN 'PST'"
                    + " WHEN UPPER(s.schedule) LIKE '%KST%' THEN 'KST'"
                    + " ELSE 'BOTH' END";

    /** 프로그램마다 가장 최근 기수 1건만. */
    private static final String LATEST_PER_PROGRAM =
            "s.id = (SELECT MAX(s2.id) FROM Study s2 WHERE s2.programId = s.programId"
                    + " AND s2.isHidden = false"
                    + " AND s2.status <> com.studyclub.domain.study.StudyStatus.DRAFT)";

    private static final String WHERE =
            " WHERE s.isHidden = false"
                    + " AND s.status <> com.studyclub.domain.study.StudyStatus.DRAFT"
                    + " AND "
                    + LATEST_PER_PROGRAM
                    + " AND (:category IS NULL OR s.category = :category)"
                    + " AND (:keyword IS NULL OR LOWER(s.title) LIKE :keyword"
                    + "   OR LOWER(s.oneLineSummary) LIKE :keyword)"
                    + " AND (:timezone IS NULL OR "
                    + TIMEZONE
                    + " = :timezone)"
                    + " AND (:phaseRank IS NULL OR "
                    + PHASE_RANK
                    + " = :phaseRank)"
                    + " AND (:deadlineBefore IS NULL OR ("
                    + PHASE_RANK
                    + " = 0 AND "
                    + DEADLINE
                    + " IS NOT NULL AND "
                    + DEADLINE
                    + " < :deadlineBefore))";

    @PersistenceContext private EntityManager em;

    @Override
    public List<Study> search(StudyListFilter filter, int offset, int limit) {
        TypedQuery<Study> query =
                bind(
                        em.createQuery(
                                "SELECT s FROM Study s"
                                        + WHERE
                                        + " ORDER BY "
                                        + PHASE_RANK
                                        + " ASC, s.id DESC",
                                Study.class),
                        filter);
        return query.setFirstResult(Math.max(offset, 0)).setMaxResults(limit).getResultList();
    }

    @Override
    public long count(StudyListFilter filter) {
        return bind(em.createQuery("SELECT COUNT(s) FROM Study s" + WHERE, Long.class), filter)
                .getSingleResult();
    }

    private <T> TypedQuery<T> bind(TypedQuery<T> query, StudyListFilter filter) {
        String keyword = filter.keyword();
        return query.setParameter("now", Instant.now())
                .setParameter(
                        "occupying", List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED))
                .setParameter("category", filter.category())
                .setParameter(
                        "keyword",
                        (keyword == null || keyword.isBlank())
                                ? null
                                : "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%")
                .setParameter(
                        "timezone", filter.timezone() == null ? null : filter.timezone().name())
                .setParameter("phaseRank", filter.phase() == null ? null : filter.phase().ordinal())
                .setParameter("deadlineBefore", filter.recruitDeadlineBefore());
    }
}
