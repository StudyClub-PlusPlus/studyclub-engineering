package com.studyclub.api.study;

import com.studyclub.domain.study.Study;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

/** 백오피스 스터디 목록 — DRAFT 포함 전 상태를 반환한다. */
@Repository
class BackofficeStudyJpqlDao implements BackofficeStudyDao {

    @PersistenceContext private EntityManager em;

    @Override
    public List<Study> getStudies(BackofficeStudyListFilter filter, int offset, int limit) {
        Assembled where = assemble(filter);
        String jpql = "SELECT s FROM Study s" + where.jpql() + orderBy(filter);
        TypedQuery<Study> query = em.createQuery(jpql, Study.class);
        where.params().forEach(query::setParameter);
        query.setFirstResult(Math.max(offset, 0));
        query.setMaxResults(limit);
        return query.getResultList();
    }

    @Override
    public long count(BackofficeStudyListFilter filter) {
        Assembled where = assemble(filter);
        String jpql = "SELECT COUNT(s) FROM Study s" + where.jpql();
        TypedQuery<Long> query = em.createQuery(jpql, Long.class);
        where.params().forEach(query::setParameter);
        return query.getSingleResult();
    }

    @Override
    public List<Study> getAllMatching(BackofficeStudyListFilter filter) {
        Assembled where = assemble(filter);
        String jpql = "SELECT s FROM Study s" + where.jpql() + " ORDER BY s.id DESC";
        TypedQuery<Study> query = em.createQuery(jpql, Study.class);
        where.params().forEach(query::setParameter);
        return query.getResultList();
    }

    private record Assembled(String jpql, Map<String, Object> params) {}

    private static Assembled assemble(BackofficeStudyListFilter filter) {
        List<String> conditions = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();

        if (filter.category() != null) {
            conditions.add("s.category = :category");
            params.put("category", filter.category());
        }
        if (filter.studyKind() != null) {
            conditions.add(
                    "s.programId IN (SELECT p.id FROM StudyProgram p WHERE p.studyKind ="
                            + " :studyKind)");
            params.put("studyKind", filter.studyKind());
        }
        if (filter.status() != null) {
            conditions.add("s.status = :status");
            params.put("status", filter.status());
        }
        if (filter.studyId() != null) {
            conditions.add("s.id = :studyId");
            params.put("studyId", filter.studyId());
        }
        if (filter.visibility() == StudyVisibility.PUBLIC) {
            conditions.add("s.status <> com.studyclub.domain.study.StudyStatus.DRAFT");
        } else if (filter.visibility() == StudyVisibility.PRIVATE) {
            conditions.add("s.status = com.studyclub.domain.study.StudyStatus.DRAFT");
        }

        String jpql = conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);
        return new Assembled(jpql, params);
    }

    private static String orderBy(BackofficeStudyListFilter filter) {
        return switch (filter.effectiveSort()) {
            case TITLE_ASC -> " ORDER BY s.title ASC, s.id ASC";
            case ID_DESC, RECRUITMENT -> " ORDER BY s.id DESC";
        };
    }
}
