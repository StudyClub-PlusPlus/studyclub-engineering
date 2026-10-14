package com.studyclub.api.account;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Repository;

/**
 * 백오피스 회원 목록 — 필터·검색·서버 정렬·페이지 (specs/admin-users/spec.md).
 *
 * <p>「참여 중」·「담당」 조건은 아래 상수 한 곳에서만 정한다. 기획이 「반 편성 전 담당 캡틴」을 참여로 세기로 하면 {@link #PARTICIPATING} 에
 * {@code STUDY.CREATED_BY} 조건을 더하는 것으로 끝난다 (plan.md 「바꾸기 쉬운 자리」).
 */
@Repository
class AdminAccountJpqlDao implements AdminAccountDao {

    /** 「참여 중」 = 명부 행 상태. 하차·완주·탈퇴는 지난 일이라 세지 않는다. 참여 역할은 가리지 않는다 (담당 캡틴의 MEMBER 행도 센다). */
    static final List<ParticipantStatus> ACTIVE_STATUSES =
            List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED);

    /**
     * 「담당」 = 스터디를 맡은 역할 — 네비게이터(LEADER) 하나다. 부반장(CO_LEADER)은 2026-10-09 에 없앴다 (POL-0001,
     * StudyCaptainGuard 와 같다).
     */
    static final List<ParticipantRole> NAVIGATOR_ROLES = List.of(ParticipantRole.LEADER);

    // 서브쿼리 조각의 별칭 p 는 바깥 쿼리의 a 에 상관된다
    private static final String PARTICIPATING =
            "p.accountId = a.id AND p.status IN :activeStatuses";
    private static final String NAVIGATING =
            PARTICIPATING + " AND p.participantRole IN :navigatorRoles";

    private static final String HAS_NAVIGATING =
            "EXISTS (SELECT 1 FROM StudyParticipant p WHERE " + NAVIGATING + ")";
    private static final String PARTICIPATING_COUNT =
            "(SELECT COUNT(DISTINCT p.studyId) FROM StudyParticipant p WHERE "
                    + PARTICIPATING
                    + ")";

    /** LIKE 이스케이프 문자. 백슬래시는 MySQL 문자열 리터럴에서 또 이스케이프라 방언마다 다르게 해석돼 피한다. */
    private static final char LIKE_ESCAPE = '!';

    @PersistenceContext private EntityManager em;

    @Override
    public List<AccountRow> getAccounts(AdminAccountListFilter filter, int offset, int limit) {
        Assembled where = assemble(filter);
        // 정렬이 서버라 집계가 쿼리 안에 있어야 한다 (spec 「정렬」). 회원 수백 명 규모라 상관 서브쿼리로 충분하다
        String jpql =
                "SELECT a, "
                        + PARTICIPATING_COUNT
                        + " FROM Account a"
                        + where.jpql()
                        + " ORDER BY CASE WHEN a.systemRole = :adminRole THEN 0 ELSE 1 END,"
                        + " CASE WHEN "
                        + HAS_NAVIGATING
                        + " THEN 0 ELSE 1 END,"
                        + " "
                        + PARTICIPATING_COUNT
                        + " DESC, a.createdAt DESC, a.id DESC";
        TypedQuery<Object[]> query = em.createQuery(jpql, Object[].class);
        Map<String, Object> params = new LinkedHashMap<>(where.params());
        params.put("adminRole", SystemRole.ADMIN);
        params.put("activeStatuses", ACTIVE_STATUSES);
        params.put("navigatorRoles", NAVIGATOR_ROLES);
        params.forEach(query::setParameter);
        query.setFirstResult(Math.max(offset, 0));
        query.setMaxResults(limit);
        return query.getResultList().stream()
                .map(row -> new AccountRow((Account) row[0], ((Number) row[1]).longValue()))
                .toList();
    }

    @Override
    public long count(AdminAccountListFilter filter) {
        Assembled where = assemble(filter);
        TypedQuery<Long> query =
                em.createQuery("SELECT COUNT(a) FROM Account a" + where.jpql(), Long.class);
        where.params().forEach(query::setParameter);
        return query.getSingleResult();
    }

    @Override
    public List<NavigatorRow> getNavigatorStudies(Collection<Long> accountIds) {
        if (accountIds.isEmpty()) {
            return List.of();
        }
        List<Object[]> rows =
                em.createQuery(
                                "SELECT p.accountId, s.id, s.title FROM StudyParticipant p"
                                        + " JOIN Study s ON s.id = p.studyId"
                                        + " WHERE p.accountId IN :accountIds"
                                        + " AND p.status IN :activeStatuses"
                                        + " AND p.participantRole IN :navigatorRoles"
                                        + " ORDER BY p.joinedAt DESC, p.id DESC",
                                Object[].class)
                        .setParameter("accountIds", accountIds)
                        .setParameter("activeStatuses", ACTIVE_STATUSES)
                        .setParameter("navigatorRoles", NAVIGATOR_ROLES)
                        .getResultList();
        // 한 스터디의 여러 반을 맡아도 스터디는 한 번만 — 먼저 나온(편입이 최신인) 행을 남긴다
        List<NavigatorRow> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Object[] row : rows) {
            Long accountId = (Long) row[0];
            Long studyId = (Long) row[1];
            if (seen.add(accountId + ":" + studyId)) {
                result.add(new NavigatorRow(accountId, studyId, (String) row[2]));
            }
        }
        return result;
    }

    private record Assembled(String jpql, Map<String, Object> params) {}

    private static Assembled assemble(AdminAccountListFilter filter) {
        List<String> conditions = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();

        switch (filter.role()) {
            case ALL -> {}
            case CAPTAIN -> {
                conditions.add("a.systemRole = :systemRole");
                params.put("systemRole", SystemRole.ADMIN);
            }
            case CREW -> {
                conditions.add("a.systemRole = :systemRole");
                params.put("systemRole", SystemRole.MEMBER);
            }
            case NAVIGATOR -> {
                conditions.add(HAS_NAVIGATING);
                params.put("activeStatuses", ACTIVE_STATUSES);
                params.put("navigatorRoles", NAVIGATOR_ROLES);
            }
        }
        if (filter.q() != null) {
            // 이름은 부분 일치(온보딩 완료자만 — 임시 닉네임으로는 찾히지 않는다), 이메일은 전체 일치만.
            // 이메일 부분 일치를 열면 「보기」를 누르지 않고 검색만 반복해 가려진 이메일을 알아낼 수 있다
            conditions.add(
                    "((a.onboardingCompletedAt IS NOT NULL AND LOWER(a.nickname) LIKE :nameLike"
                            + " ESCAPE '"
                            + LIKE_ESCAPE
                            + "') OR LOWER(a.email) = :emailExact)");
            String lowered = filter.q().toLowerCase(Locale.ROOT);
            params.put("nameLike", "%" + escapeLike(lowered) + "%");
            params.put("emailExact", lowered);
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
