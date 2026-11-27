package com.studyclub.domain.event.registration;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;

/**
 * {@link ClubEventRegistrationPageQuery} 구현 — Spring Data 가 {@code Impl} 접미사로 찾아 {@link
 * ClubEventRegistrationRepository} 에 붙인다.
 */
class ClubEventRegistrationPageQueryImpl implements ClubEventRegistrationPageQuery {

    @PersistenceContext private EntityManager em;

    @Override
    public List<ClubEventRegistration> findPageByClubEventId(
            Long clubEventId, int offset, int limit) {
        return em.createQuery(
                        "select r from ClubEventRegistration r where r.clubEventId = :eventId"
                                + " order by r.createdAt desc, r.id desc",
                        ClubEventRegistration.class)
                .setParameter("eventId", clubEventId)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }
}
