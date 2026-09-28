package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountConsent;
import com.studyclub.domain.account.AccountConsentRepository;
import com.studyclub.domain.account.AccountIdentity;
import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.AccountLeaveReasonRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.ConsentType;
import com.studyclub.domain.account.Issuer;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.application.StudyApplication;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.bookmark.StudyBookmark;
import com.studyclub.domain.bookmark.StudyBookmarkRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.proposal.StudyProposal;
import com.studyclub.domain.proposal.StudyProposalInterest;
import com.studyclub.domain.proposal.StudyProposalInterestRepository;
import com.studyclub.domain.proposal.StudyProposalRepository;
import com.studyclub.domain.proposal.StudyProposalStatus;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationCreationService;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.springframework.http.client.JdkClientHttpRequestFactory;

/**
 * DELETE /api/me — 성공 1건 + 실패 코어 (testing-guide.md). specs/user-leave/spec.md 의 처리 순서를 그대로 검증한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AccountDeletionIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired AccountIdentityRepository accountIdentityRepository;
    @Autowired AccountConsentRepository accountConsentRepository;
    @Autowired AccountLeaveReasonRepository accountLeaveReasonRepository;
    @Autowired StudyParticipantRepository studyParticipantRepository;
    @Autowired StudyBookmarkRepository studyBookmarkRepository;
    @Autowired StudyProposalRepository studyProposalRepository;
    @Autowired StudyProposalInterestRepository studyProposalInterestRepository;
    @Autowired StudyApplicationRepository studyApplicationRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired NotificationCreationService notificationCreationService;

    @BeforeEach
    void useModernHttpClient() {
        // AccountOnboardingIntegrationTest 와 같은 이유 — 바디 있는 요청에 4xx/204 가 오면
        // 레거시 클라이언트가 못 읽는다.
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    private Account seedAccount() {
        String email = "leave-" + UUID.randomUUID() + "@example.com";
        String nickname = "n" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Account account =
                accountRepository.save(new Account(email, nickname, null, SystemRole.MEMBER));
        account.completeOnboarding(nickname, "Asia/Seoul", Instant.now());
        return accountRepository.save(account);
    }

    private HttpEntity<Object> authenticatedBody(Account account, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return new HttpEntity<>(body, headers);
    }

    @Test
    @DisplayName("성공 - 계정·로그인수단·참여·관심을 물리 삭제하고, 제안은 CLOSED 로, 신청서 discordNickname·알림 스냅샷은 비식별화한다")
    void deletesAccountAndRelatedData() {
        Account account = seedAccount();
        Long accountId = account.getId();

        accountIdentityRepository.save(
                new AccountIdentity(
                        accountId,
                        Issuer.GOOGLE,
                        "sub-" + accountId,
                        account.getEmail(),
                        Instant.now()));
        accountConsentRepository.save(
                new AccountConsent(
                        accountId, ConsentType.TERMS_OF_SERVICE, true, Instant.now(), "v1"));
        studyParticipantRepository.save(
                StudyParticipant.builder()
                        .accountId(accountId)
                        .studyGroupId(9001L)
                        .studyId(9001L)
                        .status(ParticipantStatus.ACTIVE)
                        .participantRole(ParticipantRole.LEADER)
                        .joinedAt(Instant.now())
                        .build());
        studyBookmarkRepository.save(
                StudyBookmark.builder().accountId(accountId).studyId(9002L).build());

        StudyProposal openProposal =
                studyProposalRepository.save(
                        StudyProposal.builder()
                                .proposerAccountId(accountId)
                                .content("이런 스터디 열어주세요")
                                .proposedAt(Instant.now())
                                .status(StudyProposalStatus.OPEN)
                                .build());
        StudyProposal closedProposal =
                studyProposalRepository.save(
                        StudyProposal.builder()
                                .proposerAccountId(accountId)
                                .content("이미 끝난 제안")
                                .proposedAt(Instant.now())
                                .status(StudyProposalStatus.REJECTED)
                                .build());
        // 다른 회원이 내 제안에 남긴 관심 표시 — 살아남아야 한다 (제3자 데이터 보호).
        Long otherAccountId = seedAccount().getId();
        studyProposalInterestRepository.save(
                new StudyProposalInterest(openProposal.getId(), otherAccountId));
        // 내가 남긴 관심 표시 — 지워져야 한다.
        studyProposalInterestRepository.save(
                new StudyProposalInterest(openProposal.getId(), accountId));

        StudyApplication application =
                studyApplicationRepository.save(
                        StudyApplication.builder()
                                .accountId(accountId)
                                .recruitmentId(9003L)
                                .formAnswer(
                                        "{\"discordNickname\":\"홍길동/SWE/서울/시스템디자인\",\"availableDays\":[\"mon\"],\"scheduleAgreed\":true,\"answers\":{\"reason\":\"같이 읽고 싶어요\"}}")
                                .build());

        Notification pendingNotification =
                notificationRepository.save(
                        Notification.pendingImmediate(
                                NotificationEventType.USER_REGISTERED,
                                NotificationChannel.EMAIL,
                                account.getEmail(),
                                accountId,
                                1L,
                                Map.of("nickname", account.getNickname())));

        var response =
                rest.exchange(
                        "/api/me",
                        HttpMethod.DELETE,
                        authenticatedBody(account, Map.of("reason", "NO_DESIRED_STUDY")),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // 계정 · 로그인 수단 · 참여 · 관심 — 물리 삭제.
        assertThat(accountRepository.findById(accountId)).isEmpty();
        assertThat(
                        accountIdentityRepository.findByIssuerAndProviderAccountId(
                                Issuer.GOOGLE, "sub-" + accountId))
                .isEmpty();
        assertThat(accountConsentRepository.findByAccountId(accountId)).isEmpty();
        assertThat(studyParticipantRepository.findByStudyId(9001L)).isEmpty();
        assertThat(studyBookmarkRepository.countByAccountId(accountId)).isZero();

        // 탈퇴 사유 — 계정과 연결하지 않고 값만 쌓는다.
        assertThat(accountLeaveReasonRepository.findAll())
                .anySatisfy(
                        r ->
                                assertThat(r.getReason())
                                        .isEqualTo(
                                                com.studyclub.domain.account.LeaveReason
                                                        .NO_DESIRED_STUDY));

        // 제안 — OPEN 이었던 것만 CLOSED. 이미 종결 상태였던 건 그대로.
        StudyProposal reloadedOpen =
                studyProposalRepository.findById(openProposal.getId()).orElseThrow();
        assertThat(reloadedOpen.getStatus()).isEqualTo(StudyProposalStatus.CLOSED);
        StudyProposal reloadedClosed =
                studyProposalRepository.findById(closedProposal.getId()).orElseThrow();
        assertThat(reloadedClosed.getStatus()).isEqualTo(StudyProposalStatus.REJECTED);

        // 다른 회원의 관심 표시는 살아남고, 내 관심 표시는 지워진다.
        List<StudyProposalInterest> remainingInterests = studyProposalInterestRepository.findAll();
        assertThat(remainingInterests)
                .extracting(StudyProposalInterest::getAccountId)
                .containsExactly(otherAccountId);

        // 신청서 — 행은 보존, discordNickname 만 마스킹.
        StudyApplication reloadedApplication =
                studyApplicationRepository.findById(application.getId()).orElseThrow();
        assertThat(reloadedApplication.getFormAnswer())
                .doesNotContain("홍길동")
                .contains("availableDays")
                .contains("같이 읽고 싶어요");

        // 알림 — 행은 보존, 이메일·닉네임 스냅샷만 비식별화.
        Notification reloadedNotification =
                notificationRepository.findById(pendingNotification.getId()).orElseThrow();
        assertThat(reloadedNotification.getRecipientValue()).isNotEqualTo(account.getEmail());
        assertThat(reloadedNotification.getPayload().get("nickname")).isNull();
        assertThat(reloadedNotification.getStatus()).isEqualTo(NotificationStatus.CANCELLED);
    }

    @Test
    @DisplayName("성공 - JSON 객체가 아닌 FORM_ANSWER(배열·깨진 JSON)가 있어도 탈퇴는 막히지 않고, 내용은 남기지 않고 비운다")
    void deletesAccountEvenWithMalformedFormAnswer() {
        Account account = seedAccount();
        StudyApplication arrayAnswer =
                studyApplicationRepository.save(
                        StudyApplication.builder()
                                .accountId(account.getId())
                                .recruitmentId(9010L)
                                .formAnswer("[\"홍길동/SWE\"]")
                                .build());
        StudyApplication brokenAnswer =
                studyApplicationRepository.save(
                        StudyApplication.builder()
                                .accountId(account.getId())
                                .recruitmentId(9011L)
                                .formAnswer("홍길동/SWE {깨진 json")
                                .build());

        var response =
                rest.exchange(
                        "/api/me", HttpMethod.DELETE, authenticatedBody(account, null), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(accountRepository.findById(account.getId())).isEmpty();
        for (Long id : List.of(arrayAnswer.getId(), brokenAnswer.getId())) {
            // 행은 보존하되 어디에 개인정보가 있는지 알 수 없는 값이라 통째로 비운다.
            String reloaded = studyApplicationRepository.findById(id).orElseThrow().getFormAnswer();
            assertThat(reloaded).doesNotContain("홍길동").contains("{}");
        }
    }

    @Test
    @DisplayName("성공 - 사유를 생략(본문 없음)해도 탈퇴된다")
    void deletesAccountWithoutReason() {
        Account account = seedAccount();

        var response =
                rest.exchange(
                        "/api/me", HttpMethod.DELETE, authenticatedBody(account, null), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(accountRepository.findById(account.getId())).isEmpty();
    }

    @Test
    @DisplayName("실패 - 토큰 없이 탈퇴를 시도하면 401 + errorCode UNAUTHORIZED")
    void rejectsUnauthenticated() {
        var response = rest.exchange("/api/me", HttpMethod.DELETE, HttpEntity.EMPTY, Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - 정해진 값 밖의 사유는 400 + errorCode INVALID_INPUT, 계정은 지워지지 않는다")
    void rejectsInvalidReason() {
        Account account = seedAccount();

        var response =
                rest.exchange(
                        "/api/me",
                        HttpMethod.DELETE,
                        authenticatedBody(account, Map.of("reason", "이유 없음")),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(accountRepository.findById(account.getId())).isPresent();
    }

    @Test
    @DisplayName("실패 - 이미 탈퇴 처리된 계정으로 다시 요청하면 404 + errorCode NOT_FOUND")
    void rejectsAlreadyDeletedAccount() {
        Account account = seedAccount();
        rest.exchange("/api/me", HttpMethod.DELETE, authenticatedBody(account, null), Void.class);

        var response =
                rest.exchange(
                        "/api/me", HttpMethod.DELETE, authenticatedBody(account, null), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName(
            "성공/실패 - 탈퇴 전 refresh token 은 access token 을 발급하지만, 탈퇴 후에는 401 + errorCode UNAUTHORIZED")
    void refreshTokenIsRejectedAfterDeletion() {
        Account account = seedAccount();
        String refreshToken = jwt.issueRefresh(String.valueOf(account.getId()), account.getEmail());
        Map<String, String> body = Map.of("refreshToken", refreshToken);

        var before = rest.postForEntity("/auth/refresh", body, Map.class);
        assertThat(before.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(before.getBody()).containsKey("accessToken");

        rest.exchange("/api/me", HttpMethod.DELETE, authenticatedBody(account, null), Void.class);

        var after = rest.postForEntity("/auth/refresh", body, Map.class);
        assertThat(after.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(after.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("성공 - 탈퇴한 계정에 대해 웰컴메일 리스너가 뒤늦게 실행돼도 알림을 만들지 않는다")
    void welcomeEmailListenerSkipsDeletedAccount() {
        Account account = seedAccount();
        rest.exchange("/api/me", HttpMethod.DELETE, authenticatedBody(account, null), Void.class);

        notificationCreationService.createWelcomeEmailNotification(account.getId());

        assertThat(notificationRepository.findAllByOrderByCreatedAtDesc())
                .noneMatch(n -> account.getId().equals(n.getRecipientUserId()));
    }
}
