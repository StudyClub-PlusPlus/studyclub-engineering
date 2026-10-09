package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;

/**
 * PATCH /api/me — 성공 + 실패 코어 (specs/profile-edit/spec.md). 닉네임 형식 규칙의 세부는 {@link
 * NicknamePolicyTest} 가 단위로 덮는다. 여기서는 온보딩과 다른 규칙 하나, "지금 쓰는 자기 닉네임은 중복이 아니다" 를 지킨다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AccountProfileIntegrationTest {

    @Autowired TestRestTemplate rest;

    @Autowired JwtService jwt;

    @Autowired AccountRepository accountRepository;

    @BeforeEach
    void useModernHttpClient() {
        // 레거시 클라이언트는 PATCH 를 못 보내고, 바디 있는 요청의 4xx 응답도 못 읽는다.
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    /** 테스트마다 겹치지 않는 닉네임 — DB(H2)는 테스트 사이에 초기화되지 않는다. */
    private String uniqueNickname() {
        return "n" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    private Account seedUnonboardedAccount() {
        String email = "profile-" + UUID.randomUUID() + "@example.com";
        String tempNickname =
                "account_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return accountRepository.save(new Account(email, tempNickname, null, SystemRole.MEMBER));
    }

    private Account seedOnboardedAccount(String nickname) {
        Account account = seedUnonboardedAccount();
        account.completeOnboarding(nickname, "Asia/Seoul", Instant.now());
        return accountRepository.save(account);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> patchProfile(Account account, String nickname, String timeZone) {
        return patchProfile(account, Map.of("nickname", nickname, "timeZone", timeZone));
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> patchProfile(Account account, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return rest.exchange(
                "/api/me", HttpMethod.PATCH, new HttpEntity<>(body, headers), Map.class);
    }

    @Test
    @DisplayName("성공 - 닉네임·타임존을 저장하고 바뀐 AccountView 를 돌려준다")
    void updatesNicknameAndTimeZone() {
        Account account = seedOnboardedAccount(uniqueNickname());
        String newNickname = uniqueNickname();

        var response = patchProfile(account, newNickname, "America/Vancouver");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("nickname", newNickname);
        assertThat(response.getBody()).containsEntry("timeZone", "America/Vancouver");
        assertThat(response.getBody()).containsEntry("email", account.getEmail());

        Account saved = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(saved.getNickname()).isEqualTo(newNickname);
        assertThat(saved.getTimeZone()).isEqualTo("America/Vancouver");
    }

    @Test
    @DisplayName("성공 - 닉네임은 그대로 두고 타임존만 바꿔도 409 가 아니다 — 자기 닉네임은 중복으로 안 본다")
    void keepsOwnNickname() {
        String nickname = uniqueNickname();
        Account account = seedOnboardedAccount(nickname);

        var response = patchProfile(account, nickname, "America/New_York");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("nickname", nickname);
        assertThat(response.getBody()).containsEntry("timeZone", "America/New_York");
    }

    @Test
    @DisplayName("성공 - 자기 닉네임의 대소문자만 바꾸면 통과하고 새 표기로 저장한다")
    void changesOnlyCaseOfOwnNickname() {
        String nickname = uniqueNickname();
        Account account = seedOnboardedAccount(nickname);
        String upperCased = nickname.toUpperCase(Locale.ROOT);

        var response = patchProfile(account, upperCased, "Asia/Seoul");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getNickname())
                .isEqualTo(upperCased);
    }

    @Test
    @DisplayName("성공 - DB 는 같은 닉네임으로 보고 자바 비교는 다르다고 보는 표기 변경도 통과한다")
    void changesOwnNicknameToSpellingOnlyDbTreatsAsSame() {
        // 운영 DB 는 cafe 와 café 를 같게 보지만 테스트 DB(H2)는 다르게 봐서 악센트로는 이 어긋남을 못 만든다.
        // ß 는 대문자가 SS 라 H2 의 대소문자 무시 조회도 "…ß" 와 "…ss" 를 같게 본다 — 같은 어긋남이다.
        String base = uniqueNickname();
        Account account = seedOnboardedAccount(base + "ß");
        String respelled = base + "ss";
        assertThat(respelled).isNotEqualToIgnoringCase(account.getNickname());
        assertThat(accountRepository.existsByNicknameIgnoreCase(respelled)).isTrue();

        var response = patchProfile(account, respelled, "Asia/Seoul");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getNickname())
                .isEqualTo(respelled);
    }

    @Test
    @DisplayName("성공 - 화면 목록에 없는 시간대도 저장한다 — 서버는 존재하는 IANA ID 를 전부 받는다")
    void savesTimeZoneOutsideScreenList() {
        String nickname = uniqueNickname();
        Account account = seedOnboardedAccount(nickname);

        var response = patchProfile(account, nickname, "Asia/Tokyo");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getTimeZone())
                .isEqualTo("Asia/Tokyo");
    }

    @Test
    @DisplayName("성공 - 값이 하나도 안 바뀌어도 200")
    void returnsOkWhenNothingChanged() {
        String nickname = uniqueNickname();
        Account account = seedOnboardedAccount(nickname);

        var response = patchProfile(account, nickname, "Asia/Seoul");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("nickname", nickname);
        assertThat(response.getBody()).containsEntry("timeZone", "Asia/Seoul");
    }

    @Test
    @DisplayName("성공 - 닉네임 앞뒤 공백은 떼고 저장한다")
    void trimsNickname() {
        Account account = seedOnboardedAccount(uniqueNickname());
        String newNickname = uniqueNickname();

        var response = patchProfile(account, "  " + newNickname + "  ", "Asia/Seoul");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("nickname", newNickname);
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getNickname())
                .isEqualTo(newNickname);
    }

    @Test
    @DisplayName("성공 - 바디에 이메일을 실어도 무시한다 — 이메일은 여기서 못 바꾼다")
    void ignoresEmailInBody() {
        String nickname = uniqueNickname();
        Account account = seedOnboardedAccount(nickname);

        var response =
                patchProfile(
                        account,
                        Map.of(
                                "nickname", nickname,
                                "timeZone", "Asia/Seoul",
                                "email", "other@example.com"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("email", account.getEmail());
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getEmail())
                .isEqualTo(account.getEmail());
    }

    @Test
    @DisplayName("실패 - 다른 계정이 쓰는 닉네임(대소문자 무시)이면 409 CONFLICT 이고 내 값은 안 바뀐다")
    void rejectsNicknameTakenByAnotherAccount() {
        String takenNickname = uniqueNickname();
        seedOnboardedAccount(takenNickname);
        String myNickname = uniqueNickname();
        Account account = seedOnboardedAccount(myNickname);

        var response =
                patchProfile(account, takenNickname.toUpperCase(Locale.ROOT), "America/Vancouver");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
        assertThat(response.getBody()).containsEntry("errorMessage", "이미 사용 중인 닉네임입니다.");

        Account saved = accountRepository.findById(account.getId()).orElseThrow();
        assertThat(saved.getNickname()).isEqualTo(myNickname);
        assertThat(saved.getTimeZone()).isEqualTo("Asia/Seoul");
    }

    @Test
    @DisplayName("실패 - 닉네임·타임존이 둘 다 틀리면 400 INVALID_INPUT 한 응답에 두 필드가 다 담긴다")
    void rejectsInvalidFields() {
        Account account = seedOnboardedAccount(uniqueNickname());

        var response = patchProfile(account, "a", "Not/AZone");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(response.getBody().get("errorMessage"))
                .asString()
                .contains("nickname")
                .contains("timeZone");
    }

    @Test
    @DisplayName("실패 - 필드 하나를 빼고 보내면 400 INVALID_INPUT 이고 보낸 필드도 안 바뀐다 — 부분 갱신이 없다")
    void rejectsMissingField() {
        String nickname = uniqueNickname();
        Account account = seedOnboardedAccount(nickname);

        var response = patchProfile(account, Map.of("nickname", uniqueNickname()));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(response.getBody().get("errorMessage")).asString().contains("timeZone");
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getNickname())
                .isEqualTo(nickname);
    }

    @Test
    @DisplayName("실패 - 온보딩 미완료 계정은 403 ONBOARDING_REQUIRED — 닉네임을 정하는 길은 온보딩 하나다")
    void rejectsUnonboardedAccount() {
        Account account = seedUnonboardedAccount();

        var response = patchProfile(account, uniqueNickname(), "Asia/Seoul");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "ONBOARDING_REQUIRED");
    }

    @Test
    @DisplayName("실패 - 토큰 없이 부르면 401 UNAUTHORIZED")
    void rejectsUnauthenticated() {
        Map<String, Object> body = Map.of("nickname", uniqueNickname(), "timeZone", "Asia/Seoul");

        var response =
                rest.exchange("/api/me", HttpMethod.PATCH, new HttpEntity<>(body), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("순서 - 온보딩 미완료 계정이 형식이 틀린 값을 보내면 400 이 아니라 403 이다")
    void checksOnboardingBeforeFormat() {
        Account account = seedUnonboardedAccount();

        var response = patchProfile(account, "a", "Not/AZone");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "ONBOARDING_REQUIRED");
    }

    @Test
    @DisplayName("순서 - 남이 쓰는 닉네임에 시간대 형식까지 틀리면 409 가 아니라 400 이다")
    void checksFormatBeforeDuplicate() {
        String takenNickname = uniqueNickname();
        seedOnboardedAccount(takenNickname);
        Account account = seedOnboardedAccount(uniqueNickname());

        var response = patchProfile(account, takenNickname, "Not/AZone");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("동시성 - 두 계정이 같은 닉네임으로 동시에 바꾸면 한쪽만 200 이고 다른 쪽은 409 다 — 500 으로 새지 않는다")
    @SuppressWarnings("rawtypes")
    void concurrentChangesToSameNicknameAreConsistent() throws Exception {
        Account first = seedOnboardedAccount(uniqueNickname());
        Account second = seedOnboardedAccount(uniqueNickname());
        String wanted = uniqueNickname();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CyclicBarrier barrier = new CyclicBarrier(2);
        List<Callable<ResponseEntity<Map>>> calls = new ArrayList<>();
        for (Account account : List.of(first, second)) {
            calls.add(
                    () -> {
                        barrier.await(5, TimeUnit.SECONDS);
                        return patchProfile(account, wanted, "Asia/Seoul");
                    });
        }

        try {
            List<HttpStatusCode> statuses = new ArrayList<>();
            for (Future<ResponseEntity<Map>> future : pool.invokeAll(calls)) {
                statuses.add(future.get(10, TimeUnit.SECONDS).getStatusCode());
            }
            assertThat(statuses).containsExactlyInAnyOrder(HttpStatus.OK, HttpStatus.CONFLICT);
        } finally {
            pool.shutdown();
        }

        List<String> nicknames =
                List.of(
                        accountRepository.findById(first.getId()).orElseThrow().getNickname(),
                        accountRepository.findById(second.getId()).orElseThrow().getNickname());
        assertThat(nicknames).containsOnlyOnce(wanted);
    }
}
