package com.studyclub.api.sitenotice;

import com.studyclub.api.sitenotice.AdminSiteNoticeListFilter.Order;
import com.studyclub.domain.sitenotice.SiteNotice;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Repository;

@Repository
class SiteNoticeJpqlDao implements SiteNoticeDao {

    /** LIKE 이스케이프 문자. 백슬래시는 MySQL 문자열 리터럴에서 또 이스케이프라 방언마다 다르게 해석돼 피한다. */
    private static final char LIKE_ESCAPE = '!';

    private static final String ALIVE = " FROM SiteNotice n WHERE n.removedAt IS NULL";
    private static final String TITLE_LIKE =
            " AND LOWER(n.title) LIKE :titleLike ESCAPE '" + LIKE_ESCAPE + "'";

    @PersistenceContext private EntityManager em;

    @Override
    public List<SiteNotice> findAlive(int offset, int limit) {
        return em.createQuery("SELECT n" + ALIVE + " ORDER BY n.id DESC", SiteNotice.class)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }

    @Override
    public List<SiteNotice> findForAdmin(AdminSiteNoticeListFilter filter, int offset, int limit) {
        TypedQuery<SiteNotice> query =
                em.createQuery(
                        "SELECT n" + ALIVE + where(filter) + orderBy(filter), SiteNotice.class);
        bind(query, filter);
        return query.setFirstResult(offset).setMaxResults(limit).getResultList();
    }

    @Override
    public long countForAdmin(AdminSiteNoticeListFilter filter) {
        TypedQuery<Long> query =
                em.createQuery("SELECT COUNT(n)" + ALIVE + where(filter), Long.class);
        bind(query, filter);
        return query.getSingleResult();
    }

    private static String where(AdminSiteNoticeListFilter filter) {
        if (filter.q() == null) {
            return "";
        }
        return TITLE_LIKE;
    }

    private static void bind(TypedQuery<?> query, AdminSiteNoticeListFilter filter) {
        if (filter.q() != null) {
            String lowered = filter.q().toLowerCase(Locale.ROOT);
            query.setParameter("titleLike", "%" + escapeLike(lowered) + "%");
        }
    }

    /** 같은 값끼리는 {@code ID DESC} 로 다시 정렬한다 — 페이지를 넘길 때 순서가 흔들리지 않게. */
    private static String orderBy(AdminSiteNoticeListFilter filter) {
        String direction = " DESC";
        if (filter.order() == Order.ASC) {
            direction = " ASC";
        }
        String column =
                switch (filter.sort()) {
                    // 게시 시각 = 등록 시각이라 ID 순서와 같다
                    case PUBLISHED_AT -> "n.id";
                    // 운영 DB 콜레이션(utf8mb4_unicode_ci)은 대소문자를 무시하지만 테스트 H2 는 구분한다 — LOWER 로 어디서나 같게
                    case TITLE -> "LOWER(n.title)";
                    case UPDATED_AT -> "n.updatedAt";
                };
        return " ORDER BY " + column + direction + ", n.id DESC";
    }

    /** {@code %}·{@code _} 는 와일드카드가 아니라 글자로 찾는다. */
    private static String escapeLike(String value) {
        return value.replace(String.valueOf(LIKE_ESCAPE), "" + LIKE_ESCAPE + LIKE_ESCAPE)
                .replace("%", LIKE_ESCAPE + "%")
                .replace("_", LIKE_ESCAPE + "_");
    }
}
