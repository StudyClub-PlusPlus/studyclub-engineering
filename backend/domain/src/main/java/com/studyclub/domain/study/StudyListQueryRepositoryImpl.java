package com.studyclub.domain.study;

import com.studyclub.domain.participant.ParticipantStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

/** 목록 조회 실행부 — 조건의 <b>뜻</b>은 {@link StudyListQuery} 가 갖고, 여기서는 값을 묶어 실행·페이징만 한다. */
public class StudyListQueryRepositoryImpl implements StudyListQueryRepository {

    private static final List<ParticipantStatus> OCCUPYING =
            List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED);

    @PersistenceContext private EntityManager em;

    @Override
    public List<Study> search(StudyListFilter filter, int offset, int limit) {
        return bind(em.createNamedQuery(Study.LIST_SEARCH, Study.class), filter)
                .setFirstResult(Math.max(offset, 0))
                .setMaxResults(limit)
                .getResultList();
    }

    @Override
    public long count(StudyListFilter filter) {
        return bind(em.createNamedQuery(Study.LIST_COUNT, Long.class), filter).getSingleResult();
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
