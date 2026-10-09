package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 등록 모달의 「기존 클럽의 새 기수」 드롭다운이 쓰는 목록.
 *
 * <p>여기서 확인하는 것은 두 가지다 — <b>클럽만 나온다</b>(스터디는 기수가 1개라 새 기수를 붙일 수 없다)와 <b>{@code latestStudyId} 가 최신
 * 기수</b>라는 것(그 id 로 상세를 다시 불러 폼을 채운다).
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyProgramListIntegrationTest {

    private static final Long ADMIN_ID = 8301L;
    private static final Long MEMBER_ID = 8302L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyProgramRepository studyProgramRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        studyRepository.deleteAll();
        studyProgramRepository.deleteAll();
        Timestamp now = Timestamp.from(Instant.now());
        insertAccountIfAbsent(ADMIN_ID, "admin-programs@example.test", SystemRole.ADMIN, now);
        insertAccountIfAbsent(MEMBER_ID, "member-programs@example.test", SystemRole.MEMBER, now);
    }

    @Test
    @DisplayName("성공 - 클럽만 나오고, 스터디 종류 프로그램은 빠진다")
    void listsClubsOnly() {
        StudyProgram club = saveProgram("영어 회화 클럽", StudyKind.CLUB);
        saveProgram("한 번 하는 스터디", StudyKind.STUDY);

        assertThat(titles(get("/api/admin/study-programs?studyKind=CLUB")))
                .containsExactly("영어 회화 클럽");
        assertThat(items(get("/api/admin/study-programs?studyKind=CLUB")).getFirst())
                .containsEntry("programId", club.getId().intValue());
    }

    @Test
    @DisplayName("성공 - latestStudyId 는 그 프로그램에서 ID 가 가장 큰 기수다")
    void latestStudyIdIsTheNewestCohort() {
        StudyProgram club = saveProgram("북클럽", StudyKind.CLUB);
        saveStudy(club, "1기");
        Study second = saveStudy(club, "2기");

        assertThat(items(get("/api/admin/study-programs?studyKind=CLUB")).getFirst())
                .containsEntry("latestStudyId", second.getId().intValue());
    }

    @Test
    @DisplayName("성공 - 기수가 아직 없는 프로그램은 latestStudyId 가 null 이다 (채워 넣을 값이 없다)")
    void latestStudyIdIsNullWithoutCohorts() {
        saveProgram("기수 없는 클럽", StudyKind.CLUB);

        assertThat(items(get("/api/admin/study-programs?studyKind=CLUB")).getFirst())
                .containsEntry("latestStudyId", null);
    }

    @Test
    @DisplayName("실패 - ADMIN 이 아니면 403")
    void memberIsRejected() {
        var response =
                rest.exchange(
                        "/api/admin/study-programs?studyKind=CLUB",
                        HttpMethod.GET,
                        authenticated(MEMBER_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ── fixtures ─────────────────────────────────────────────────────────

    private StudyProgram saveProgram(String title, StudyKind kind) {
        return studyProgramRepository.save(
                StudyProgram.builder().title(title).studyKind(kind).build());
    }

    private Study saveStudy(StudyProgram program, String title) {
        return studyRepository.save(
                Study.builder()
                        .programId(program.getId())
                        .title(title)
                        .oneLineSummary("소개")
                        .category(StudyCategory.OTHER)
                        .status(StudyStatus.DRAFT)
                        .build());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> get(String path) {
        var response = rest.exchange(path, HttpMethod.GET, authenticated(ADMIN_ID), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return response.getBody();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> items(Map<String, Object> body) {
        return (List<Map<String, Object>>) body.get("items");
    }

    private List<Object> titles(Map<String, Object> body) {
        return items(body).stream().map(item -> item.get("title")).toList();
    }

    private HttpEntity<Void> authenticated(Long accountId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(tokenFor(accountId));
        return new HttpEntity<>(headers);
    }

    private String tokenFor(Long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        return jwtService.issueAccess(String.valueOf(accountId), email);
    }

    private void insertAccountIfAbsent(Long id, String email, SystemRole role, Timestamp now) {
        if (accountRepository.findById(id).isPresent()) {
            return;
        }
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                email,
                "programs_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }
}
