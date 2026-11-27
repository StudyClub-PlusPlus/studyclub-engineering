package com.studyclub.domain.event.mail;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;

/** {@link ClubEventMailPageQuery} 구현 — Spring Data 가 {@code Impl} 접미사로 찾아 붙인다. */
class ClubEventMailPageQueryImpl implements ClubEventMailPageQuery {

    @PersistenceContext private EntityManager em;

    @Override
    public List<ClubEventMail> findPageByClubEventId(Long clubEventId, int offset, int limit) {
        return em.createQuery(
                        "select m from ClubEventMail m where m.clubEventId = :eventId"
                                + " order by m.createdAt desc, m.id desc",
                        ClubEventMail.class)
                .setParameter("eventId", clubEventId)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }
}
