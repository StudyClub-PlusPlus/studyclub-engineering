package com.studyclub.api.sitenotice;

import com.studyclub.domain.sitenotice.SiteNotice;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
class SiteNoticeJpqlDao implements SiteNoticeDao {

    private static final String ALIVE = " FROM SiteNotice n WHERE n.removedAt IS NULL";

    @PersistenceContext private EntityManager em;

    @Override
    public List<SiteNotice> findAlive(int offset, int limit) {
        return em.createQuery("SELECT n" + ALIVE + " ORDER BY n.id DESC", SiteNotice.class)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }
}
