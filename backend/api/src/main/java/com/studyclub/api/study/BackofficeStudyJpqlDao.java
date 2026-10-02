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

/** 백오피스 스터디 목록 — DRAFT 포함 전 상태를 반환한다. 공개 목록({@link StudyListJpqlDao})과 달리 단계·모집 상태 계산이 없다. */
@Repository
class BackofficeStudyJpqlDao implements BackofficeStudyDao {

    @PersistenceContext private EntityManager em;

    @Override
    public List<Study> getStudies(BackofficeStudyListFilter filter, int offset, int limit) {
        Assembled where = assemble(filter);
        String jpql = "SELECT s FROM Study s" + where.jpql() + " ORDER BY s.id DESC";
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

    private record Assembled(String jpql, Map<String, Object> params) {}

    private static Assembled assemble(BackofficeStudyListFilter filter) {
        List<String> conditions = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();

        if (filter.category() != null) {
            conditions.add("s.category = :category");
            params.put("category", filter.category());
        }
        // 종류는 프로그램이 갖는다 — 기수에는 컬럼이 없어 프로그램을 거쳐 거른다
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

        String jpql = conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);
        return new Assembled(jpql, params);
    }
}
