package com.studyclub.api.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * 캡틴 둘이 동시에 서로를 내리면 한쪽만 성공한다 — ADMIN 행 잠금(specs/admin-users/spec.md 「처리 규칙」 1)이 캡틴 0명을 막는지 본다.
 *
 * <p><b>타이밍이 아니라 잠금을 증명한다.</b> 서비스를 직접 두 스레드에서 부른다(HTTP 를 거치면 인터셉터가 진 쪽을 403 으로 바꿀 수 있다). 먼저 온 요청이
 * 잠금을 쥔 채 감사 로그 저장에서 멈추게 하고, 그 사이 뒤 요청이 실제로 막혀 있는지(끝나지 않는지) 확인한 뒤 풀어 준다. 잠금이 없으면 뒤 요청은 막히지 않고 바로
 * 성공해 이 테스트가 실패한다.
 *
 * <p>같은 DB 에 다른 테스트가 남긴 ADMIN 이 있으면 「둘뿐」이라는 전제가 깨져, 이 테스트의 두 계정을 뺀 ADMIN 을 잠시 MEMBER 로 내렸다가 끝나고
 * 되돌린다.
 */
@SpringBootTest
class AdminAccountRoleConcurrencyTest {

    private static final long ADMIN_A = 9961L;
    private static final long ADMIN_B = 9962L;

    @Autowired AdminAccountRoleService service;
    @Autowired JdbcTemplate jdbcTemplate;
    @MockitoSpyBean AdminAuditLogRepository adminAuditLogRepository;
    @PersistenceContext EntityManager entityManager;

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
    @DisplayName(
            "캡틴 둘이 동시에 서로를 내리면 뒤 요청은 앞 요청이 끝날 때까지 막혔다가 LAST_ADMIN_REQUIRED 로 거절되고, 캡틴이 한 명 남는다")
    void secondDemotionBlocksUntilFirstCommitsThenIsRejected() throws Exception {
        CountDownLatch reached = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicBoolean first = new AtomicBoolean(true);
        // 스파이는 인터페이스 프록시라 callRealMethod 가 안 되므로, 같은 트랜잭션에 묶인 EntityManager 로 직접 저장한다.
        // 첫 호출만 여기서 멈춘다 — 이 시점에 앞 요청은 ADMIN 행 잠금과 B 의 강등(미커밋)을 쥐고 있다
        doAnswer(
                        inv -> {
                            AdminAuditLog log = inv.getArgument(0);
                            entityManager.persist(log);
                            entityManager.flush();
                            if (first.getAndSet(false)) {
                                reached.countDown();
                                if (!release.await(30, TimeUnit.SECONDS)) {
                                    throw new IllegalStateException("release not signalled");
                                }
                            }
                            return log;
                        })
                .when(adminAuditLogRepository)
                .save(any());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            // A 가 B 를 내린다 — 먼저 와서 잠금을 쥐고 감사 로그 저장에서 멈춘다
            Future<?> firstRequest =
                    pool.submit(
                            () -> service.changeSystemRole(ADMIN_A, ADMIN_B, SystemRole.MEMBER));
            assertThat(reached.await(10, TimeUnit.SECONDS)).as("앞 요청이 잠금을 쥐고 멈췄다").isTrue();

            // B 가 A 를 내린다 — 같은 ADMIN 행을 잠그려다 막혀야 한다
            Future<?> secondRequest =
                    pool.submit(
                            () -> service.changeSystemRole(ADMIN_B, ADMIN_A, SystemRole.MEMBER));
            assertThatThrownBy(() -> secondRequest.get(500, TimeUnit.MILLISECONDS))
                    .as("뒤 요청은 앞 요청이 커밋하기 전에는 끝나지 않는다")
                    .isInstanceOf(TimeoutException.class);
            assertThat(secondRequest.isDone()).isFalse();

            release.countDown();

            firstRequest.get(10, TimeUnit.SECONDS); // 앞 요청은 성공
            assertThatThrownBy(() -> secondRequest.get(10, TimeUnit.SECONDS))
                    .hasRootCauseInstanceOf(BusinessException.class)
                    .satisfies(
                            e ->
                                    assertThat(((BusinessException) e.getCause()).errorCode())
                                            .isEqualTo(ErrorCode.LAST_ADMIN_REQUIRED));
            assertThat(
                            jdbcTemplate.queryForObject(
                                    "SELECT COUNT(*) FROM ACCOUNT WHERE SYSTEM_ROLE = 'ADMIN'",
                                    Long.class))
                    .isEqualTo(1L);
            assertThat(
                            jdbcTemplate.queryForObject(
                                    "SELECT SYSTEM_ROLE FROM ACCOUNT WHERE ID = ?",
                                    String.class,
                                    ADMIN_A))
                    .isEqualTo("ADMIN");
            // 성공한 쪽의 감사 기록만 남는다
            assertThat(
                            jdbcTemplate.queryForObject(
                                    "SELECT COUNT(*) FROM ADMIN_AUDIT_LOG WHERE ACTOR_ACCOUNT_ID IN"
                                            + " (?, ?)",
                                    Long.class,
                                    ADMIN_A,
                                    ADMIN_B))
                    .isEqualTo(1L);
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
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
