package com.studyclub.api.study;

import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.Study;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Repository;

/**
 * 관리자 목록의 검색·필터·정렬·페이지를 DB에서 처리한다. MySQL JSON 함수로 기존 신청 폼의 질문 배열을 검사하므로 native SQL을 사용한다. 전체 건수와
 * 페이지는 같은 조건·asOf를 사용하며 정렬식은 enum으로만 선택한다.
 */
@Repository
class BackofficeStudyQueryDao implements BackofficeStudyDao {
    private static final String APPLICANTS =
            "(SELECT COUNT(a.ID) FROM STUDY_APPLICATION a WHERE a.RECRUITMENT_ID = r.ID)";

    // Study.recruitStatus()의 조회 조건. 최신 모집 회차의 모든 신청서를 세며 계정/명부로 거르지 않는다.
    // OPEN의 null 마감·null 정원·모집 회차 없음도 기존 엔티티와 동일하게 처리한다.
    // 정책 변경 시 AdminStudyQueryIntegrationTest의 엔티티 대비 검증도 함께 유지한다.
    private static final String RECRUITING =
            "(s.STATUS = 'OPEN'"
                    + " AND (r.RECRUIT_DEADLINE_AT IS NULL OR r.RECRUIT_DEADLINE_AT > :asOf)"
                    + " AND (r.RECRUITMENT_CAPACITY IS NULL OR "
                    + APPLICANTS
                    + " < r.RECRUITMENT_CAPACITY))";

    private static final String RECRUIT_ORDER = "CASE WHEN " + RECRUITING + " THEN 0 ELSE 1 END";

    // 객체/배열과 과거 JSON 문자열로 이중 저장된 값을 모두 기존 hasQuestions()와 같이 읽는다.
    private static final String FORM_DOCUMENT =
            "(CASE WHEN JSON_VALID(s.APPLICATION_FORM) = 1 THEN"
                    + " CASE WHEN JSON_TYPE(s.APPLICATION_FORM) = 'STRING' THEN"
                    + " CASE WHEN JSON_VALID(JSON_UNQUOTE(s.APPLICATION_FORM)) = 1"
                    + " THEN JSON_UNQUOTE(s.APPLICATION_FORM) ELSE NULL END"
                    + " ELSE CONCAT('', s.APPLICATION_FORM) END ELSE NULL END)";
    private static final String QUESTIONS =
            "(CASE WHEN JSON_TYPE("
                    + FORM_DOCUMENT
                    + ") = 'ARRAY' THEN "
                    + FORM_DOCUMENT
                    + " ELSE JSON_EXTRACT("
                    + FORM_DOCUMENT
                    + ", '$.questions') END)";
    private static final String HAS_FORM =
            "CASE WHEN JSON_TYPE("
                    + QUESTIONS
                    + ") = 'ARRAY' AND JSON_LENGTH("
                    + QUESTIONS
                    + ") > 0 THEN 1 ELSE 0 END";

    @PersistenceContext private EntityManager em;

    @Override
    @SuppressWarnings("unchecked")
    public List<Study> getStudies(
            BackofficeStudyListFilter filter, Instant asOf, int offset, int limit) {
        Sql sql = assemble(filter, asOf, true);
        Query query =
                em.createNativeQuery("SELECT s.*" + sql.fromWhere() + orderBy(filter), Study.class);
        sql.params().forEach(query::setParameter);
        return query.setFirstResult(offset).setMaxResults(limit).getResultList();
    }

    @Override
    public long count(BackofficeStudyListFilter filter, Instant asOf) {
        Sql sql = assemble(filter, asOf, false);
        Query query = em.createNativeQuery("SELECT COUNT(*)" + sql.fromWhere());
        sql.params().forEach(query::setParameter);
        return ((Number) query.getSingleResult()).longValue();
    }

    private record Sql(String fromWhere, Map<String, Object> params) {}

    private static Sql assemble(BackofficeStudyListFilter filter, Instant asOf, boolean sorted) {
        List<String> conditions = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();
        if (filter.category() != null) {
            conditions.add("s.CATEGORY = :category");
            params.put("category", filter.category().name());
        }
        if (filter.studyKind() != null) {
            conditions.add(
                    "s.PROGRAM_ID IN (SELECT p.ID FROM STUDY_PROGRAM p WHERE p.STUDY_KIND = :kind)");
            params.put("kind", filter.studyKind().name());
        }
        if (filter.status() != null) {
            conditions.add("s.STATUS = :status");
            params.put("status", filter.status().name());
        }
        if (filter.studyId() != null) {
            conditions.add("s.ID = :studyId");
            params.put("studyId", filter.studyId());
        }
        if (filter.visibility() != null) {
            conditions.add(
                    filter.visibility() == StudyVisibility.PUBLIC
                            ? "s.STATUS <> 'DRAFT'"
                            : "s.STATUS = 'DRAFT'");
        }
        if (filter.keyword() != null) {
            conditions.add(
                    "(LOWER(s.TITLE) LIKE :keyword ESCAPE '!'"
                            + " OR LOWER(s.ONE_LINE_SUMMARY) LIKE :keyword ESCAPE '!')");
            String keyword =
                    filter.keyword()
                            .strip()
                            .toLowerCase(Locale.ROOT)
                            .replace("!", "!!")
                            .replace("%", "!%")
                            .replace("_", "!_");
            params.put("keyword", "%" + keyword + "%");
        }
        if (filter.hasApplicationForm() != null) {
            conditions.add("(" + HAS_FORM + ") = :hasForm");
            params.put("hasForm", filter.hasApplicationForm() ? 1 : 0);
        }
        boolean recruitFilter = filter.recruitStatus() != null || filter.recruitFilter() != null;
        if (filter.recruitStatus() != null) {
            conditions.add("s.STATUS = 'OPEN'");
            conditions.add(
                    filter.recruitStatus() == RecruitStatus.RECRUITING
                            ? RECRUITING
                            : "NOT " + RECRUITING);
        }
        if (filter.recruitFilter() != null) {
            conditions.add(
                    filter.recruitFilter() == AdminStudyRecruitFilter.RECRUITING
                            ? RECRUITING
                            : "NOT " + RECRUITING);
        }
        BackofficeStudySort sort = filter.effectiveSort();
        boolean recruitSort =
                sorted
                        && switch (sort) {
                            case RECRUITMENT, RECRUITMENT_FIRST, RECRUIT_ASC, RECRUIT_DESC -> true;
                            default -> false;
                        };
        boolean recruitmentDataSort =
                sorted
                        && switch (sort) {
                            case RECRUIT_START_ASC,
                                    RECRUIT_START_DESC,
                                    RECRUIT_END_ASC,
                                    RECRUIT_END_DESC,
                                    APPLICANTS_ASC,
                                    APPLICANTS_DESC ->
                                    true;
                            default -> false;
                        };
        if (recruitFilter || recruitSort) {
            params.put("asOf", Timestamp.from(asOf));
        }
        // 일반 필터·건수 조회에는 필요 없는 모집/작성자 JOIN을 붙이지 않는다.
        String from = " FROM STUDY s";
        if (recruitFilter || recruitSort || recruitmentDataSort) {
            from +=
                    " LEFT JOIN STUDY_RECRUITMENT r ON r.ID ="
                            + " (SELECT MAX(latest.ID) FROM STUDY_RECRUITMENT latest WHERE latest.STUDY_ID = s.ID)";
        }
        if (sorted
                && (sort == BackofficeStudySort.AUTHOR_ASC
                        || sort == BackofficeStudySort.AUTHOR_DESC)) {
            from += " LEFT JOIN ACCOUNT author ON author.ID = s.CREATED_BY";
        }
        return new Sql(
                from + (conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions)),
                params);
    }

    private static String orderBy(BackofficeStudyListFilter filter) {
        BackofficeStudySort sort = filter.effectiveSort();
        if (sort == BackofficeStudySort.ID_DESC) return " ORDER BY s.ID DESC";
        if (sort == BackofficeStudySort.RECRUITMENT
                || sort == BackofficeStudySort.RECRUITMENT_FIRST
                || sort == BackofficeStudySort.RECRUIT_ASC) {
            return " ORDER BY "
                    + RECRUIT_ORDER
                    + " ASC,"
                    + " CASE WHEN r.RECRUIT_DEADLINE_AT IS NULL THEN 1 ELSE 0 END ASC,"
                    + " r.RECRUIT_DEADLINE_AT ASC, s.TITLE ASC, s.ID ASC";
        }
        String name = sort.name();
        String column = name.substring(0, name.lastIndexOf('_'));
        String expression =
                switch (column) {
                    case "PROGRAM" -> "s.PROGRAM_ID";
                    case "TITLE" -> "s.TITLE";
                    case "STATUS" ->
                            "CASE s.STATUS WHEN 'DRAFT' THEN 0 WHEN 'OPEN' THEN 1"
                                    + " WHEN 'ONGOING' THEN 2 WHEN 'ENDED' THEN 3 WHEN 'CLOSED' THEN 4 END";
                    case "CATEGORY" ->
                            "CASE s.CATEGORY WHEN 'AI_ML' THEN 'AI · ML'"
                                    + " WHEN 'ALGORITHM' THEN '알고리즘' WHEN 'DATA' THEN '데이터'"
                                    + " WHEN 'SOFTWARE' THEN '소프트웨어 개발' WHEN 'CAREER' THEN '커리어'"
                                    + " WHEN 'BOOK_CLUB' THEN '북클럽' WHEN 'LANGUAGE' THEN '어학'"
                                    + " WHEN 'LIFESTYLE' THEN '라이프스타일' WHEN 'PRODUCT' THEN '기획 · PM'"
                                    + " WHEN 'BUSINESS' THEN '비즈니스' WHEN 'OTHER' THEN '기타' END";
                    case "TIMEZONE" ->
                            "CASE s.TIMEZONE WHEN 'KST' THEN 0 WHEN 'PST' THEN 1 WHEN 'BOTH' THEN 2 END";
                    case "RECRUIT_START" -> "r.START_AT";
                    case "RECRUIT_END" -> "r.RECRUIT_DEADLINE_AT";
                    case "RECRUIT" -> RECRUIT_ORDER;
                    case "APPLICANTS" -> APPLICANTS;
                    case "START_AT" -> "s.START_AT";
                    case "FORM" -> HAS_FORM;
                    case "VISIBILITY" -> "CASE WHEN s.STATUS = 'DRAFT' THEN 0 ELSE 1 END";
                    case "AUTHOR" -> "NULLIF(author.NICKNAME, '')";
                    default -> throw new IllegalArgumentException("지원하지 않는 정렬: " + sort);
                };
        String direction = name.endsWith("_DESC") ? " DESC" : " ASC";
        return " ORDER BY CASE WHEN ("
                + expression
                + ") IS NULL THEN 1 ELSE 0 END ASC, ("
                + expression
                + ")"
                + direction
                + ", s.ID ASC";
    }
}
