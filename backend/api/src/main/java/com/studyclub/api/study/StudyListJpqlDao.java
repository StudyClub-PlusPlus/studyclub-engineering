package com.studyclub.api.study;

import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyPhase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Repository;

/**
 * {@link StudyListDao} 의 JPQL 구현 — <b>조건을 받아 쿼리를 조립</b>한다. 걸리지 않은 필터는 절 자체가 만들어지지 않는다.
 *
 * <p>판정(무엇이 모집 중인가·어느 시간대인가)은 도메인이 한다 — {@link Study#phase} · {@link Study#timezone} · {@link
 * Study#recruitStatus}. 여기 {@link #PHASE_RANK} 는 <b>같은 규칙을 DB 에서 한 번 더</b> 쓴 것이다. 페이지네이션 때문에 거르고
 * 정렬하는 일이 DB 에서 일어나야 해서 생긴 복제라, 한쪽을 고치면 다른 쪽도 고친다 — {@code StudyListIntegrationTest} 가 {@code
 * status} 필터 결과와 응답 {@code phase} 를 함께 본다.
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

    /**
     * 공개 대상 — 숨김·작성 중(DRAFT)은 뺀다. 필터와 무관하게 항상 걸린다.
     *
     * <p>기수를 묶지 않는다. 같은 프로그램의 3기가 진행 중이고 4기가 모집 중이면 <b>둘 다</b> 나와야 한다 — 기획도 스터디 단위로
     * 나열한다(planning/stories/crew-browse-studies). 묶어서 최신 1건만 주면 진행 중인 기수가 목록에서 사라진다.
     */
    private static final String VISIBLE =
            "s.isHidden = false" + " AND s.status <> com.studyclub.domain.study.StudyStatus.DRAFT";

    /** 모집 중 → 진행 중 → 종료, 같은 단계에서는 최근 등록 순. 사용자가 고르는 정렬은 없다. */
    private static final String ORDER_BY = " ORDER BY " + PHASE_RANK + " ASC, s.id DESC";

    @PersistenceContext private EntityManager em;

    @Override
    public List<Study> search(StudyListFilter filter, int offset, int limit) {
        Assembled where = assemble(filter);
        String jpql = "SELECT s FROM Study s" + where.jpql() + ORDER_BY;
        return bind(em.createQuery(jpql, Study.class), jpql, where)
                .setFirstResult(Math.max(offset, 0))
                .setMaxResults(limit)
                .getResultList();
    }

    @Override
    public long count(StudyListFilter filter) {
        Assembled where = assemble(filter);
        String jpql = "SELECT COUNT(s) FROM Study s" + where.jpql();
        return bind(em.createQuery(jpql, Long.class), jpql, where).getSingleResult();
    }

    /** 조립 결과 — WHERE 절과 그 절이 쓰는 값. */
    private record Assembled(String jpql, Map<String, Object> params) {}

    private static Assembled assemble(StudyListFilter filter) {
        List<String> conditions = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();

        conditions.add(VISIBLE);

        if (filter.category() != null) {
            conditions.add("s.category = :category");
            params.put("category", filter.category());
        }
        String keyword = likePattern(filter.keyword());
        if (keyword != null) {
            conditions.add(
                    "(LOWER(s.title) LIKE :keyword OR LOWER(s.oneLineSummary) LIKE :keyword)");
            params.put("keyword", keyword);
        }
        if (filter.timezone() != null) {
            conditions.add(TIMEZONE + " = :timezone");
            params.put("timezone", filter.timezone().name());
        }
        if (filter.phase() != null) {
            conditions.add(PHASE_RANK + " = :phaseRank");
            params.put("phaseRank", filter.phase().ordinal());
        }
        // 종료 임박 — 지금 신청할 수 있는 스터디 중에서만 고른다
        if (filter.recruitDeadlineBefore() != null) {
            conditions.add(
                    "("
                            + PHASE_RANK
                            + " = 0 AND "
                            + CURRENT_DEADLINE
                            + " IS NOT NULL AND "
                            + CURRENT_DEADLINE
                            + " < :deadlineBefore)");
            params.put("deadlineBefore", filter.recruitDeadlineBefore());
        }

        return new Assembled(" WHERE " + String.join(" AND ", conditions), params);
    }

    /**
     * 조립된 값과, 단계 판정이 쓰는 {@code :now}·{@code :occupying} 을 바인딩한다. 단계 판정은 필터로도 정렬로도 들어올 수 있어, 최종 JPQL
     * 에 그 이름이 실제로 남았을 때만 넣는다 (없는 파라미터를 넣으면 Hibernate 가 예외를 던진다).
     */
    private <T> TypedQuery<T> bind(TypedQuery<T> query, String jpql, Assembled where) {
        where.params().forEach(query::setParameter);
        if (jpql.contains(":now")) {
            query.setParameter("now", Instant.now());
        }
        if (jpql.contains(":occupying")) {
            query.setParameter("occupying", OCCUPYING);
        }
        return query;
    }

    private static String likePattern(String keyword) {
        return (keyword == null || keyword.isBlank())
                ? null
                : "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
    }
}
