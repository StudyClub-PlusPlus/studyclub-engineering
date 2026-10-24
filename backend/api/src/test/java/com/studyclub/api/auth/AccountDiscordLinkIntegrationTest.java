package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** POST /api/me/discord/link — 성공 1건 + 실패 코어 (testing-guide.md). 디스코드 왕복만 가짜다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AccountDiscordLinkIntegrationTest {

    private static final String PATH = "/api/me/discord/link";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @MockitoBean DiscordOAuthClient discordOAuthClient;

    @BeforeEach
    void useModernHttpClient() {
        // AccountDeletionIntegrationTest 와 같은 이유 — 바디 있는 요청에 4xx/204 가 오면 레거시 클라이언트가 못 읽는다
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    private Account seedAccount() {
        String nickname = "n" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return accountRepository.save(
                new Account(
                        "discord-" + UUID.randomUUID() + "@example.com",
                        nickname,
                        null,
                        SystemRole.MEMBER));
    }

    private static String randomSnowflake() {
        return String.valueOf(ThreadLocalRandom.current().nextLong(1L << 56, Long.MAX_VALUE));
    }

    private ResponseEntity<Map> post(Account account, Object body) {
        HttpHeaders headers = new HttpHeaders();
        if (account != null) {
            headers.setBearerAuth(
                    jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        }
        return rest.postForEntity(PATH, new HttpEntity<>(body, headers), Map.class);
    }

    @Test
    @DisplayName("성공 - 디스코드가 준 ID·핸들을 저장하고, 바디의 discordId 는 무시한다")
    void linksDiscordFromServerSideExchange() {
        Account account = seedAccount();
        String discordId = randomSnowflake();
        when(discordOAuthClient.exchange("good-code"))
                .thenReturn(new DiscordOAuthClient.DiscordUser(discordId, "jiwon_dev"));

        ResponseEntity<Map> res =
                post(account, Map.of("code", "good-code", "discordId", "1", "handle", "fake"));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        Account saved = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(saved.getDiscordId()).isEqualTo(discordId);
        assertThat(saved.getDiscordHandle()).isEqualTo("jiwon_dev");
    }

    @Test
    @DisplayName("409 - 그 디스코드 ID 가 다른 계정에 있으면 저장하지 않는다")
    void conflictWhenAnotherAccountOwnsId() {
        String discordId = randomSnowflake();
        Account owner = seedAccount();
        owner.linkDiscord(discordId, "owner");
        accountRepository.save(owner);
        Account account = seedAccount();
        when(discordOAuthClient.exchange(anyString()))
                .thenReturn(new DiscordOAuthClient.DiscordUser(discordId, "someone"));

        ResponseEntity<Map> res = post(account, Map.of("code", "good-code"));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(res.getBody()).containsEntry("errorCode", "CONFLICT");
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getDiscordId())
                .isNull();
    }

    @Test
    @DisplayName("400 - code 가 없으면 INVALID_INPUT")
    void badRequestWithoutCode() {
        ResponseEntity<Map> res = post(seedAccount(), Map.of());

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(res.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("401 - 로그인하지 않으면 UNAUTHORIZED")
    void unauthorizedWithoutLogin() {
        ResponseEntity<Map> res = post(null, Map.of("code", "good-code"));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
