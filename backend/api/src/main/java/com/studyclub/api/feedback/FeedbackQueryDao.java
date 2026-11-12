package com.studyclub.api.feedback;

import com.studyclub.domain.feedback.Feedback;
import com.studyclub.domain.feedback.FeedbackStatus;
import com.studyclub.domain.feedback.FeedbackType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Repository;

/**
 * 문의 목록 — 내 문의 · 운영 목록 (specs/feedback/spec.md). 오프셋을 그대로 받으려고 Spring Data 의 페이지 대신 JPQL 에 직접 건다 —
 * 화면의 오프셋이 페이지 크기의 배수가 아니어도 된다. 정렬은 둘 다 접수 시각 내림차순 고정이다.
 */
@Repository
class FeedbackQueryDao {

    private static final String ORDER = " ORDER BY f.createdAt DESC, f.id DESC";

    /** LIKE 이스케이프 문자 — AdminAccountJpqlDao 와 같은 이유로 백슬래시를 피한다. */
    private static final char LIKE_ESCAPE = '!';

    @PersistenceContext private EntityManager em;

    List<Feedback> findMine(Long accountId, int offset, int limit) {
        return em.createQuery(
                        "SELECT f FROM Feedback f WHERE f.accountId = :accountId" + ORDER,
                        Feedback.class)
                .setParameter("accountId", accountId)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }

    long countMine(Long accountId) {
        return em.createQuery(
                        "SELECT COUNT(f) FROM Feedback f WHERE f.accountId = :accountId",
                        Long.class)
                .setParameter("accountId", accountId)
                .getSingleResult();
    }

    List<Feedback> findForAdmin(AdminFilter filter, int offset, int limit) {
        Assembled where = assemble(filter);
        TypedQuery<Feedback> query =
                em.createQuery("SELECT f FROM Feedback f" + where.jpql() + ORDER, Feedback.class);
        where.params().forEach(query::setParameter);
        return query.setFirstResult(offset).setMaxResults(limit).getResultList();
    }

    long countForAdmin(AdminFilter filter) {
        Assembled where = assemble(filter);
        TypedQuery<Long> query =
                em.createQuery("SELECT COUNT(f) FROM Feedback f" + where.jpql(), Long.class);
        where.params().forEach(query::setParameter);
        return query.getSingleResult();
    }

    /**
     * @param q 앞뒤 공백을 자른 검색어. 없으면 null
     */
    record AdminFilter(FeedbackType type, FeedbackStatus status, String q) {}

    private record Assembled(String jpql, Map<String, Object> params) {}

    private static Assembled assemble(AdminFilter filter) {
        List<String> conditions = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();
        if (filter.type() != null) {
            conditions.add("f.type = :type");
            params.put("type", filter.type());
        }
        if (filter.status() != null) {
            conditions.add("f.status = :status");
            params.put("status", filter.status());
        }
        if (filter.q() != null) {
            conditions.add(
                    "(LOWER(f.title) LIKE :like ESCAPE '"
                            + LIKE_ESCAPE
                            + "' OR LOWER(f.content) LIKE :like ESCAPE '"
                            + LIKE_ESCAPE
                            + "')");
            params.put("like", "%" + escapeLike(filter.q().toLowerCase(Locale.ROOT)) + "%");
        }
        String jpql = conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);
        return new Assembled(jpql, params);
    }

    /** {@code %}·{@code _} 는 와일드카드가 아니라 글자로 찾는다. */
    private static String escapeLike(String value) {
        return value.replace(String.valueOf(LIKE_ESCAPE), "" + LIKE_ESCAPE + LIKE_ESCAPE)
                .replace("%", LIKE_ESCAPE + "%")
                .replace("_", LIKE_ESCAPE + "_");
    }
}
