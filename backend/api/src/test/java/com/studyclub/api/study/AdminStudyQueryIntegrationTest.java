package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyStatus;
import jakarta.persistence.EntityManagerFactory;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/** 기본 H2 테스트와 작업용 빈 MySQL DB에서 같은 조회 계약을 검증한다. */
@SpringBootTest
@Transactional
class AdminStudyQueryIntegrationTest {
    private static final Instant AS_OF = Instant.parse("2026-10-31T12:00:00Z");
    private static final long PROGRAM = 980_000L;
    @Autowired JdbcTemplate jdbc;
    @Autowired BackofficeStudyListService service;
    @Autowired EntityManagerFactory entityManagerFactory;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        // 운영/공유 DB는 사용하지 않는다. MySQL 검증은 작업용 빈 DB 주소를 명시할 때만 실행한다.
        String mysql = System.getenv("STUDY_QUERY_TEST_JDBC_URL");
        registry.add(
                "spring.datasource.url",
                () ->
                        mysql == null
                                ? "jdbc:h2:mem:admin-study-query;MODE=MySQL;DB_CLOSE_DELAY=-1"
                                : mysql);
        registry.add(
                "spring.datasource.driver-class-name",
                () -> mysql == null ? "org.h2.Driver" : "com.mysql.cj.jdbc.Driver");
        registry.add("spring.datasource.username", () -> mysql == null ? "sa" : "root");
        registry.add("spring.datasource.password", () -> "");
        registry.add(
                "spring.jpa.properties.hibernate.dialect",
                () ->
                        mysql == null
                                ? "org.hibernate.dialect.H2Dialect"
                                : "org.hibernate.dialect.MySQLDialect");
    }

    @BeforeEach
    void seed() throws Exception {
        try (var connection = jdbc.getDataSource().getConnection()) {
            if (connection.getMetaData().getDatabaseProductName().equals("H2")) {
                H2StudyJsonFunctions.install(jdbc);
            }
        }
        jdbc.update(
                "INSERT INTO STUDY_PROGRAM (ID,TITLE,STUDY_KIND,CREATED_AT,UPDATED_AT) VALUES (?,?,'STUDY',?,?)",
                PROGRAM,
                "목록 조회 검증",
                Timestamp.from(AS_OF),
                Timestamp.from(AS_OF));
    }

    @Test
    @DisplayName("제목·소개를 검색하고 와일드카드 문자도 일반 문자로 찾는다")
    void keywordAndCombinedFilters() {
        study(1, "AI Study", "기본 소개", StudyStatus.OPEN, null);
        study(2, "다른 제목", "AI 학습", StudyStatus.ONGOING, null);
        study(3, "100%_완료!", "기본 소개", StudyStatus.DRAFT, null);
        assertThat(ids(page(" ai ", null, null, null, null))).containsExactly(2L, 1L);
        assertThat(ids(page("AI", null, null, null, StudyStatus.ONGOING))).containsExactly(2L);
        assertThat(ids(page("%_", null, null, null, null))).containsExactly(3L);
        assertThat(ids(page("!", null, null, null, null))).containsExactly(3L);
    }

    @Test
    @DisplayName("SQL 모집 필터는 공통 엔티티의 상태·마감 경계·정원 판정과 일치한다")
    void recruitmentMatchesDomain() {
        List<Long> recruiting = new ArrayList<>();
        List<Long> notRecruiting = new ArrayList<>();
        List<Long> closedOpen = new ArrayList<>();
        long id = 1;
        for (StudyStatus status : StudyStatus.values()) {
            for (Instant deadline :
                    new Instant[] {null, AS_OF.minusSeconds(1), AS_OF, AS_OF.plusSeconds(1)}) {
                for (Integer capacity : new Integer[] {null, 1, 2}) {
                    study(id, "상태 " + id, "", status, null);
                    recruitment(id, id, deadline, capacity);
                    application(id, id);
                    RecruitStatus expected =
                            Study.builder()
                                    .status(status)
                                    .build()
                                    .recruitStatus(1, deadline, capacity, AS_OF);
                    if (expected == RecruitStatus.RECRUITING) recruiting.add(id);
                    else notRecruiting.add(id);
                    if (expected == RecruitStatus.RECRUIT_CLOSED) closedOpen.add(id);
                    id++;
                }
            }
        }
        assertThat(ids(page(null, AdminStudyRecruitFilter.RECRUITING, null, null, null)))
                .containsExactlyInAnyOrderElementsOf(recruiting);
        assertThat(ids(page(null, AdminStudyRecruitFilter.NOT_RECRUITING, null, null, null)))
                .containsExactlyInAnyOrderElementsOf(notRecruiting);
        assertThat(
                        ids(
                                page(
                                        null,
                                        AdminStudyRecruitFilter.NOT_RECRUITING,
                                        null,
                                        null,
                                        StudyStatus.OPEN)))
                .containsExactlyInAnyOrderElementsOf(closedOpen);
        var legacy =
                new BackofficeStudyListFilter(
                        StudyCategory.OTHER,
                        null,
                        null,
                        null,
                        null,
                        RecruitStatus.RECRUIT_CLOSED,
                        null);
        assertThat(ids(service.getStudies(legacy, 0, 100, AS_OF)))
                .containsExactlyInAnyOrderElementsOf(closedOpen);
    }

    @Test
    @DisplayName("최신 모집 회차만 보고 탈퇴 계정의 신청서도 현재 공통 기준대로 센다")
    void latestRecruitmentAndMissingAccount() {
        study(1, "최신 회차", "", StudyStatus.OPEN, null);
        recruitment(10, 1, AS_OF.plusSeconds(100), 1);
        application(10, 10); // 이전 회차는 정원이 차 있다
        recruitment(11, 1, AS_OF.plusSeconds(100), 1);
        assertThat(ids(page(null, AdminStudyRecruitFilter.RECRUITING, null, null, null)))
                .containsExactly(1L);
        application(11, 11); // ACCOUNT 행이 없는 신청서도 포함
        assertThat(ids(page(null, AdminStudyRecruitFilter.NOT_RECRUITING, null, null, null)))
                .containsExactly(1L);
        var item = page(null, null, null, null, null).items().getFirst();
        assertThat(item.currentApplicants()).isEqualTo(1);
        assertThat(item.recruitStatus()).isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("모집 회차가 없는 OPEN도 기존 공통 판정과 같이 모집중이다")
    void missingRecruitment() {
        study(1, "회차 없음", "", StudyStatus.OPEN, null);
        study(2, "초안", "", StudyStatus.DRAFT, null);
        assertThat(ids(page(null, AdminStudyRecruitFilter.RECRUITING, null, null, null)))
                .containsExactly(1L);
        assertThat(ids(page(null, AdminStudyRecruitFilter.NOT_RECRUITING, null, null, null)))
                .containsExactly(2L);
    }

    @Test
    @DisplayName("신청 폼 필터와 응답은 객체·배열·이중 저장·빈 값에서 같은 결과를 낸다")
    void formFilterMatchesResponse() {
        List<String> forms =
                java.util.Arrays.asList(
                        null,
                        "{}",
                        "[]",
                        "{\"questions\":[]}",
                        "{\"questions\":[{}]}",
                        "[{}]",
                        "{\"questions\":\"text\"}",
                        "\"invalid\"",
                        new ObjectMapper().writeValueAsString("{\"questions\":[{}]}"));
        for (int i = 0; i < forms.size(); i++)
            study(i + 1, "폼 " + i, "", StudyStatus.OPEN, forms.get(i));
        var all = page(null, null, null, null, null);
        for (boolean hasForm : List.of(true, false)) {
            List<Long> expected =
                    all.items().stream()
                            .filter(s -> s.hasApplicationForm() == hasForm)
                            .map(BackofficeStudyListResponse.StudySummary::studyId)
                            .toList();
            var filtered = page(null, null, hasForm, BackofficeStudySort.FORM_DESC, null);
            assertThat(ids(filtered)).containsExactlyInAnyOrderElementsOf(expected);
            assertThat(filtered.total()).isEqualTo(expected.size());
        }
        assertThat(ids(page(null, null, true, null, null))).contains(5L, 6L);
        var formOrder = page(null, null, null, BackofficeStudySort.FORM_ASC, null).items();
        assertThat(formOrder.stream().map(s -> s.hasApplicationForm() ? 1 : 0).toList()).isSorted();
    }

    @ParameterizedTest
    @EnumSource(BackofficeStudySort.class)
    @DisplayName("모든 열별 정렬을 DB에서 실행하며 제한한 페이지와 전체 건수를 반환한다")
    void everySortUsesDatabase(BackofficeStudySort sort) {
        study(1, "B", "", StudyStatus.OPEN, "{\"questions\":[{}]}");
        study(2, "A", "", StudyStatus.OPEN, null);
        recruitment(1, 1, AS_OF.plusSeconds(60), 3);
        recruitment(2, 2, null, null);
        var filter = filter(null, null, null, sort, StudyStatus.OPEN);
        var result = service.getStudies(filter, 0, 1, AS_OF);
        var second = service.getStudies(filter, 1, 1, AS_OF);
        assertThat(result.total()).isEqualTo(2);
        assertThat(result.items()).hasSize(1);
        assertThat(second.items()).hasSize(1);
        assertThat(ids(result)).doesNotContainAnyElementsOf(ids(second));
    }

    @Test
    @DisplayName("모집 기본 정렬과 날짜 열은 null을 뒤에 두고 마감 경계를 동일하게 적용한다")
    void orderAndNulls() {
        study(1, "B", "", StudyStatus.OPEN, null);
        study(2, "A", "", StudyStatus.OPEN, null);
        study(3, "마감", "", StudyStatus.OPEN, null);
        study(4, "진행", "", StudyStatus.ONGOING, null);
        recruitment(1, 1, null, null);
        recruitment(2, 2, AS_OF.plusSeconds(100), null);
        recruitment(3, 3, AS_OF, null);
        assertThat(ids(page(null, null, null, BackofficeStudySort.RECRUITMENT_FIRST, null)))
                .containsExactly(2L, 1L, 3L, 4L);
        assertThat(ids(page(null, null, null, BackofficeStudySort.RECRUIT_END_ASC, null)))
                .containsExactly(3L, 2L, 1L, 4L);
        assertThat(ids(page(null, null, null, BackofficeStudySort.RECRUIT_END_DESC, null)))
                .containsExactly(2L, 3L, 1L, 4L);
        assertThat(ids(page(null, null, null, BackofficeStudySort.STATUS_ASC, null)))
                .containsExactly(1L, 2L, 3L, 4L);
    }

    @Test
    @DisplayName("열 정렬은 표시 값·신청서 수를 비교하고 작성자 누락은 항상 뒤에 둔다")
    void columnSortValues() {
        study(1, "Z", "", StudyStatus.OPEN, "[{}]");
        study(2, "A", "", StudyStatus.DRAFT, null);
        study(3, "M", "", StudyStatus.ENDED, "[{}]");
        for (long i : List.of(1L, 3L)) {
            jdbc.update(
                    "INSERT INTO ACCOUNT (ID,EMAIL,NICKNAME,SYSTEM_ROLE,TIME_ZONE,CREATED_AT,UPDATED_AT)"
                            + " VALUES (?,?,?,'ADMIN','Asia/Seoul',?,?)",
                    990_000 + i,
                    "sort" + i + "@example.com",
                    i == 1 ? "Zulu" : "Alpha",
                    Timestamp.from(AS_OF),
                    Timestamp.from(AS_OF));
            jdbc.update("UPDATE STUDY SET CREATED_BY=? WHERE ID=?", 990_000 + i, i);
        }
        jdbc.update("UPDATE STUDY SET TIMEZONE='BOTH' WHERE ID=1");
        jdbc.update("UPDATE STUDY SET TIMEZONE='KST' WHERE ID=2");
        jdbc.update("UPDATE STUDY SET TIMEZONE='PST' WHERE ID=3");
        recruitment(1, 1, AS_OF.plusSeconds(200), null);
        recruitment(2, 2, null, null);
        recruitment(3, 3, AS_OF.plusSeconds(100), null);
        application(1, 1);
        application(2, 3);
        jdbc.update(
                "INSERT INTO STUDY_APPLICATION (ID,ACCOUNT_ID,RECRUITMENT_ID,FORM_ANSWER,CREATED_AT,UPDATED_AT)"
                        + " VALUES (3,999998,1,CAST('{}' AS JSON),?,?)",
                Timestamp.from(AS_OF),
                Timestamp.from(AS_OF));
        Map<BackofficeStudySort, List<Long>> expected =
                Map.ofEntries(
                        Map.entry(BackofficeStudySort.TITLE_ASC, List.of(2L, 3L, 1L)),
                        Map.entry(BackofficeStudySort.TITLE_DESC, List.of(1L, 3L, 2L)),
                        Map.entry(BackofficeStudySort.STATUS_ASC, List.of(2L, 1L, 3L)),
                        Map.entry(BackofficeStudySort.STATUS_DESC, List.of(3L, 1L, 2L)),
                        Map.entry(BackofficeStudySort.TIMEZONE_ASC, List.of(2L, 3L, 1L)),
                        Map.entry(BackofficeStudySort.TIMEZONE_DESC, List.of(1L, 3L, 2L)),
                        Map.entry(BackofficeStudySort.APPLICANTS_ASC, List.of(2L, 3L, 1L)),
                        Map.entry(BackofficeStudySort.APPLICANTS_DESC, List.of(1L, 3L, 2L)),
                        Map.entry(BackofficeStudySort.FORM_ASC, List.of(2L, 1L, 3L)),
                        Map.entry(BackofficeStudySort.FORM_DESC, List.of(1L, 3L, 2L)),
                        Map.entry(BackofficeStudySort.VISIBILITY_ASC, List.of(2L, 1L, 3L)),
                        Map.entry(BackofficeStudySort.VISIBILITY_DESC, List.of(1L, 3L, 2L)),
                        Map.entry(BackofficeStudySort.AUTHOR_ASC, List.of(3L, 1L, 2L)),
                        Map.entry(BackofficeStudySort.AUTHOR_DESC, List.of(1L, 3L, 2L)),
                        Map.entry(BackofficeStudySort.RECRUITMENT_FIRST, List.of(1L, 3L, 2L)),
                        Map.entry(BackofficeStudySort.RECRUIT_DESC, List.of(2L, 3L, 1L)));
        expected.forEach(
                (sort, ids) ->
                        assertThat(ids(page(null, null, null, sort, null)))
                                .as(sort.name())
                                .containsExactlyElementsOf(ids));
    }

    @Test
    @DisplayName("1만 건이 넘어도 모집 필터·정렬은 한 페이지의 엔티티만 적재한다")
    void largeListLoadsOnlyPage() {
        List<Object[]> batch =
                IntStream.rangeClosed(1, 10_005)
                        .mapToObj(
                                i ->
                                        new Object[] {
                                            (long) i,
                                            PROGRAM,
                                            "페이지 " + i,
                                            Timestamp.from(AS_OF),
                                            Timestamp.from(AS_OF)
                                        })
                        .toList();
        jdbc.batchUpdate(
                "INSERT INTO STUDY (ID,PROGRAM_ID,TITLE,ONE_LINE_SUMMARY,CATEGORY,STATUS,CREATED_AT,UPDATED_AT)"
                        + " VALUES (?,?,?,'','OTHER','OPEN',?,?)",
                batch);
        jdbc.update(
                "INSERT INTO STUDY_RECRUITMENT (ID,STUDY_ID,TITLE,DESCRIPTION,RECRUITMENT_CAPACITY,RECRUIT_DEADLINE_AT,CREATED_AT,UPDATED_AT)"
                        + " SELECT ID,ID,'모집','',2,?,CREATED_AT,UPDATED_AT FROM STUDY WHERE PROGRAM_ID=?",
                Timestamp.from(AS_OF.plusSeconds(86400)),
                PROGRAM);
        jdbc.update(
                "INSERT INTO STUDY_APPLICATION (ID,ACCOUNT_ID,RECRUITMENT_ID,FORM_ANSWER,CREATED_AT,UPDATED_AT)"
                        + " SELECT ID,999999,ID,CAST('{}' AS JSON),CREATED_AT,UPDATED_AT FROM STUDY_RECRUITMENT");
        var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            var filter =
                    filter(
                            null,
                            AdminStudyRecruitFilter.RECRUITING,
                            null,
                            BackofficeStudySort.RECRUITMENT_FIRST,
                            null);
            var page = service.getStudies(filter, 10_000, 20, AS_OF);
            assertThat(page.total()).isEqualTo(10_005);
            assertThat(page.items()).hasSize(5);
            assertThat(statistics.getEntityLoadCount()).isLessThanOrEqualTo(15);
            assertThat(service.getStudies(filter, 10_020, 20, AS_OF).items()).isEmpty();
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    private BackofficeStudyListResponse page(
            String keyword,
            AdminStudyRecruitFilter recruit,
            Boolean form,
            BackofficeStudySort sort,
            StudyStatus status) {
        return service.getStudies(filter(keyword, recruit, form, sort, status), 0, 100, AS_OF);
    }

    private BackofficeStudyListFilter filter(
            String keyword,
            AdminStudyRecruitFilter recruit,
            Boolean form,
            BackofficeStudySort sort,
            StudyStatus status) {
        return new BackofficeStudyListFilter(
                StudyCategory.OTHER, null, status, null, null, null, sort, keyword, form, recruit);
    }

    private List<Long> ids(BackofficeStudyListResponse response) {
        return response.items().stream()
                .map(BackofficeStudyListResponse.StudySummary::studyId)
                .toList();
    }

    private void study(long id, String title, String summary, StudyStatus status, String form) {
        jdbc.update(
                "INSERT INTO STUDY (ID,PROGRAM_ID,TITLE,ONE_LINE_SUMMARY,CATEGORY,STATUS,APPLICATION_FORM,CREATED_AT,UPDATED_AT)"
                        + " VALUES (?,?,?,?,'OTHER',?,CAST(? AS JSON),?,?)",
                id,
                PROGRAM,
                title,
                summary,
                status.name(),
                form,
                Timestamp.from(AS_OF),
                Timestamp.from(AS_OF));
    }

    private void recruitment(long id, long studyId, Instant deadline, Integer capacity) {
        jdbc.update(
                "INSERT INTO STUDY_RECRUITMENT (ID,STUDY_ID,TITLE,DESCRIPTION,RECRUIT_DEADLINE_AT,RECRUITMENT_CAPACITY,CREATED_AT,UPDATED_AT)"
                        + " VALUES (?,?,'모집','',?,?,?,?)",
                id,
                studyId,
                deadline == null ? null : Timestamp.from(deadline),
                capacity,
                Timestamp.from(AS_OF),
                Timestamp.from(AS_OF));
    }

    private void application(long id, long recruitmentId) {
        jdbc.update(
                "INSERT INTO STUDY_APPLICATION (ID,ACCOUNT_ID,RECRUITMENT_ID,FORM_ANSWER,CREATED_AT,UPDATED_AT)"
                        + " VALUES (?,999999,?,CAST('{}' AS JSON),?,?)",
                id,
                recruitmentId,
                Timestamp.from(AS_OF),
                Timestamp.from(AS_OF));
    }
}
