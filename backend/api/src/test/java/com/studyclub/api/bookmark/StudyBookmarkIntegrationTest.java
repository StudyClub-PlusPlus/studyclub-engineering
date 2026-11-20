package com.studyclub.api.bookmark;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"spring.datasource.url=jdbc:h2:mem:bookmark;MODE=MySQL;DB_CLOSE_DELAY=-1"})
@AutoConfigureTestRestTemplate
class StudyBookmarkIntegrationTest {

    private static final AtomicLong IDS = new AtomicLong(970_000L);

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbc;

    private long program;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        program = IDS.incrementAndGet();
        Timestamp now = Timestamp.from(Instant.now());
        jdbc.update(
                "INSERT INTO STUDY_PROGRAM (ID,TITLE,STUDY_KIND,CREATED_AT,UPDATED_AT) VALUES (?,'북마크',"
                        + "'STUDY',?,?)",
                program,
                now,
                now);
    }

    private long study(String status) {
        long id = IDS.incrementAndGet();
        Timestamp now = Timestamp.from(Instant.now());
        jdbc.update(
                "INSERT INTO STUDY (ID,PROGRAM_ID,TITLE,ONE_LINE_SUMMARY,CATEGORY,STATUS,CREATED_AT,UPDATED_AT)"
                        + " VALUES (?,?,?,'','OTHER',?,?,?)",
                id,
                program,
                "스터디 " + id,
                status,
                now,
                now);
        return id;
    }

    private Account crew() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account account =
                accountRepository.save(
                        new Account(
                                "bm-" + suffix + "@example.com",
                                "account_" + suffix,
                                null,
                                SystemRole.MEMBER));
        account.completeOnboarding("n" + suffix, "Asia/Seoul", Instant.now());
        return accountRepository.save(account);
    }

    private ResponseEntity<Map> call(HttpMethod method, String path, Account account) {
        HttpHeaders headers = new HttpHeaders();
        if (account != null) {
            headers.setBearerAuth(
                    jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        }
        return rest.exchange(path, method, new HttpEntity<>(headers), Map.class);
    }

    @SuppressWarnings("unchecked")
    private List<Number> savedIds(Account account) {
        List<Map<String, Object>> items =
                (List<Map<String, Object>>)
                        call(HttpMethod.GET, "/api/me/bookmarks?limit=100", account)
                                .getBody()
                                .get("items");
        return items.stream().map(it -> (Number) it.get("studyId")).toList();
    }

    @Test
    @DisplayName("담기 · 빼기는 여러 번 불러도 결과가 같고 목록에 studyId 가 나온다")
    void addRemoveIdempotent() {
        Account me = crew();
        long id = study("OPEN");

        assertThat(call(HttpMethod.POST, "/api/me/bookmarks/" + id, me).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(call(HttpMethod.POST, "/api/me/bookmarks/" + id, me).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(savedIds(me)).extracting(Number::longValue).containsExactly(id);

        assertThat(call(HttpMethod.DELETE, "/api/me/bookmarks/" + id, me).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(call(HttpMethod.DELETE, "/api/me/bookmarks/" + id, me).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(savedIds(me)).isEmpty();
    }

    @Test
    @DisplayName("빼기는 본인 줄만 지운다")
    void removeOnlyMine() {
        Account me = crew();
        Account other = crew();
        long id = study("OPEN");
        call(HttpMethod.POST, "/api/me/bookmarks/" + id, other);

        call(HttpMethod.DELETE, "/api/me/bookmarks/" + id, me);

        assertThat(savedIds(other)).extracting(Number::longValue).containsExactly(id);
    }

    @Test
    @DisplayName("없는 스터디 · 공개 전 스터디는 404, 토큰이 없으면 401")
    void rejects() {
        Account me = crew();
        assertThat(call(HttpMethod.POST, "/api/me/bookmarks/" + study("DRAFT"), me).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(call(HttpMethod.POST, "/api/me/bookmarks/99999999", me).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(
                        call(HttpMethod.POST, "/api/me/bookmarks/" + study("OPEN"), null)
                                .getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
