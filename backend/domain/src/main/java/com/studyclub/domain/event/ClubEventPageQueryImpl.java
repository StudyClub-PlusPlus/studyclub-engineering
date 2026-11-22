package com.studyclub.domain.event;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;

/**
 * {@link ClubEventPageQuery} 구현 — Spring Data 가 {@code Impl} 접미사로 찾아 {@link ClubEventRepository} 에
 * 붙인다.
 */
class ClubEventPageQueryImpl implements ClubEventPageQuery {

    @PersistenceContext private EntityManager em;

    @Override
    public List<Long> findPageIds(int offset, int limit) {
        return em.createQuery(
                        "select e.id from ClubEvent e order by e.startsAt desc, e.id desc",
                        Long.class)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }
}
