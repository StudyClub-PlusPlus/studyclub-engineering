package com.studyclub.api.account;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.SystemRole;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 캡틴 둘이 동시에 서로를 내리면 한쪽만 성공한다 — ADMIN 행 잠금(specs/admin-users/spec.md 「처리 규칙」 1)이 캡틴 0명을 막는지 본다.
 *
 * <p>같은 DB 에 다른 테스트가 남긴 ADMIN 이 있으면 「둘뿐」이라는 전제가 깨져 이 테스트의 두 계정을 뺀 ADMIN 을 잠시 MEMBER 로 내렸다가 끝나고
 * 되돌린다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminAccountRoleConcurrencyTest {

    private static final long ADMIN_A = 9961L;
    private static final long ADMIN_B = 9962L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired JdbcTemplate jdbcTemplate;

    private List<Long> otherAdminIds = List.of();

    @BeforeEach
    void seed() {
        cleanSeedRows();
        otherAdminIds =
                jdbcTemplate.queryForList(
                        "SELECT ID FROM ACCOUNT WHERE SYSTEM_ROLE = 'ADMIN'", Long.class);
        jdbcTemplate.update(
                "UPDATE ACCOUNT SET SYSTEM_ROLE = 'MEMBER' WHERE SYSTEM_ROLE = 'ADMIN'");
        Timestamp now = Timestamp.from(Instant.now());
        insertAccount(ADMIN_A, now);
        insertAccount(ADMIN_B, now);
    }

    @AfterEach
    void cleanUp() {
        cleanSeedRows();
        for (Long id : otherAdminIds) {
            jdbcTemplate.update("UPDATE ACCOUNT SET SYSTEM_ROLE = 'ADMIN' WHERE ID = ?", id);
        }
    }

    @Test
    @DisplayName("캡틴 둘이 동시에 서로를 크루로 내리면 한쪽만 200 이고 다른 쪽은 409 LAST_ADMIN_REQUIRED, 캡틴이 한 명 남는다")
    void onlyOneOfTwoMutualDemotionsSucceeds() throws Exception {
        // 첫 호출의 초기화 비용이 두 요청의 겹침을 흩뜨리지 않게 미리 데운다
        rest.exchange(
                "/api/admin/role-permissions",
                HttpMethod.GET,
                new HttpEntity<>(bearer(ADMIN_A)),
                Map.class);

        CyclicBarrier barrier = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Callable<Map.Entry<HttpStatus, String>>> calls =
                    List.of(
                            () -> demote(barrier, ADMIN_A, ADMIN_B),
                            () -> demote(barrier, ADMIN_B, ADMIN_A));
            List<Future<Map.Entry<HttpStatus, String>>> futures = new ArrayList<>();
            for (var call : calls) {
                futures.add(pool.submit(call));
            }
            List<Map.Entry<HttpStatus, String>> results = new ArrayList<>();
            for (var future : futures) {
                results.add(future.get(30, TimeUnit.SECONDS));
            }

            assertThat(results)
                    .extracting(Map.Entry::getKey)
                    .containsExactlyInAnyOrder(HttpStatus.OK, HttpStatus.CONFLICT);
            assertThat(results)
                    .filteredOn(r -> r.getKey() == HttpStatus.CONFLICT)
                    .singleElement()
                    .satisfies(r -> assertThat(r.getValue()).contains("LAST_ADMIN_REQUIRED"));
            assertThat(
                            jdbcTemplate.queryForObject(
                                    "SELECT COUNT(*) FROM ACCOUNT WHERE SYSTEM_ROLE = 'ADMIN'",
                                    Long.class))
                    .isEqualTo(1L);
        } finally {
            pool.shutdownNow();
        }
    }

    private Map.Entry<HttpStatus, String> demote(CyclicBarrier barrier, long actorId, long targetId)
            throws Exception {
        HttpHeaders headers = bearer(actorId);
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> request = new HttpEntity<>("{\"systemRole\":\"MEMBER\"}", headers);
        barrier.await(10, TimeUnit.SECONDS);
        var response =
                rest.exchange(
                        "/api/admin/users/" + targetId + "/system-role",
                        HttpMethod.PATCH,
                        request,
                        String.class);
        return Map.entry(HttpStatus.valueOf(response.getStatusCode().value()), response.getBody());
    }

    private HttpHeaders bearer(long accountId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(
                jwtService.issueAccess(
                        String.valueOf(accountId), "concurrency-" + accountId + "@example.com"));
        return headers;
    }

    private void cleanSeedRows() {
        jdbcTemplate.update(
                "DELETE FROM ADMIN_AUDIT_LOG WHERE ACTOR_ACCOUNT_ID IN (?, ?)"
                        + " OR TARGET_ACCOUNT_ID IN (?, ?)",
                ADMIN_A,
                ADMIN_B,
                ADMIN_A,
                ADMIN_B);
        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID IN (?, ?)", ADMIN_A, ADMIN_B);
    }

    private void insertAccount(long id, Timestamp now) {
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "concurrency-" + id + "@example.com",
                "concur_" + id,
                SystemRole.ADMIN.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }
}
