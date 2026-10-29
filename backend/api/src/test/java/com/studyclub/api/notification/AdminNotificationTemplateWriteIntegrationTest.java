package com.studyclub.api.notification;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.common.error.BusinessException;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties =
                "spring.datasource.url=jdbc:h2:mem:notification-template-write;MODE=MySQL;DB_CLOSE_DELAY=-1")
@AutoConfigureTestRestTemplate
class AdminNotificationTemplateWriteIntegrationTest {

    private static final String PATH = "/api/admin/notification-templates";

    @Autowired TestRestTemplate testRestTemplate;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired NotificationTemplateRepository notificationTemplateRepository;
    @Autowired NotificationTemplateCommandService commandService;

    private Account admin;

    @BeforeEach
    void setUp() {
        notificationRepository.deleteAll();
        notificationTemplateRepository.deleteAll();
        admin = account(SystemRole.ADMIN);
    }

    private Account account(SystemRole role) {
        String unique = UUID.randomUUID().toString();
        return accountRepository.save(
                new Account(unique + "@example.com", "n" + unique.substring(0, 10), null, role));
    }

    private HttpHeaders headersOf(Account account) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(
                jwtService.issueAccess(account.getId().toString(), account.getEmail()));
        return headers;
    }

    private HttpEntity<Object> asAdmin(Object body) {
        return new HttpEntity<>(body, headersOf(admin));
    }

    private static NotificationTemplateRequest request(String subject, String body) {
        return new NotificationTemplateRequest(
                NotificationEventType.USER_REGISTERED, subject, body);
    }

    private NotificationTemplate seedStudyNotice() {
        return notificationTemplateRepository.save(
                NotificationTemplate.create(
                        NotificationEventType.STUDY_NOTICE,
                        "[StudyClub] {{studyTitle}} 공지",
                        "{{title}}",
                        null));
    }

    private NotificationTemplateResponse createTemplate() {
        var response =
                testRestTemplate.exchange(
                        PATH,
                        HttpMethod.POST,
                        asAdmin(request("환영합니다", "안녕하세요, {{nickname}}님.")),
                        NotificationTemplateResponse.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return response.getBody();
    }

    // ───────────── POST ─────────────

    @Test
    @DisplayName("ADMIN 이 템플릿을 추가한다 — 201, 채널은 메일로 고정, 수정자는 토큰의 계정")
    void adminCreatesTemplate() {
        var response =
                testRestTemplate.exchange(
                        PATH,
                        HttpMethod.POST,
                        asAdmin(request("환영합니다", "안녕하세요, {{nickname}}님.")),
                        NotificationTemplateResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        var body = response.getBody();
        assertThat(body.id()).isNotNull();
        assertThat(body.eventType()).isEqualTo("USER_REGISTERED");
        assertThat(body.channel()).isEqualTo("EMAIL");
        assertThat(body.body()).isEqualTo("안녕하세요, {{nickname}}님.");
        assertThat(body.updatedAt()).isNotNull();
        assertThat(body.updatedByAdminId()).isEqualTo(admin.getId());
        assertThat(notificationTemplateRepository.findById(body.id())).isPresent();
    }

    @Test
    @DisplayName("같은 조건에 이미 템플릿이 있으면 추가가 409 CONFLICT")
    void createRejectsTakenCondition() {
        createTemplate();

        var response =
                testRestTemplate.exchange(
                        PATH, HttpMethod.POST, asAdmin(request("또 하나", "본문")), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
        assertThat(notificationTemplateRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("지운 뒤에는 같은 조건에 다시 추가할 수 있다")
    void canCreateAgainAfterDelete() {
        var created = createTemplate();
        testRestTemplate.exchange(
                PATH + "/" + created.id(), HttpMethod.DELETE, asAdmin(null), Void.class);

        createTemplate();

        assertThat(notificationTemplateRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("제목·본문이 비었거나 모르는 조건이면 추가가 400 INVALID_INPUT")
    void createRejectsInvalidInput() {
        Object[] bodies = {
            request("", "본문"),
            request("   ", "본문"),
            request("제목", ""),
            request("제목", "   "),
            Map.of("eventType", "NO_SUCH_EVENT", "subject", "제목", "body", "본문"),
            Map.of("subject", "제목", "body", "본문")
        };
        for (Object body : bodies) {
            var response =
                    testRestTemplate.exchange(PATH, HttpMethod.POST, asAdmin(body), Map.class);
            assertThat(response.getStatusCode()).as("%s", body).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
        assertThat(notificationTemplateRepository.count()).isZero();
    }

    @Test
    @DisplayName("제목은 255자까지, 256자는 400 — 글자 수 기준")
    void subjectLimitIsCharacters() {
        var tooLong =
                testRestTemplate.exchange(
                        PATH, HttpMethod.POST, asAdmin(request("가".repeat(256), "본문")), Map.class);
        assertThat(tooLong.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        var ok =
                testRestTemplate.exchange(
                        PATH,
                        HttpMethod.POST,
                        asAdmin(request("가".repeat(255), "본문")),
                        NotificationTemplateResponse.class);
        assertThat(ok.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    @DisplayName("본문은 UTF-8 65,535바이트까지, 1바이트만 넘어도 400 — 글자 수가 아니라 바이트 기준")
    void bodyLimitIsBytes() {
        String atLimit = "가".repeat(21_845); // 한글 3바이트 × 21,845 = 65,535바이트
        var tooLong =
                testRestTemplate.exchange(
                        PATH, HttpMethod.POST, asAdmin(request("제목", atLimit + "a")), Map.class);
        assertThat(tooLong.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(tooLong.getBody()).containsEntry("errorCode", "INVALID_INPUT");

        var ok =
                testRestTemplate.exchange(
                        PATH,
                        HttpMethod.POST,
                        asAdmin(request("제목", atLimit)),
                        NotificationTemplateResponse.class);
        assertThat(ok.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(ok.getBody().body()).hasSize(21_845);
    }

    @Test
    @DisplayName("동시에 추가해도 하나만 만들어지고 나머지는 409 — 유일 제약 위반이 500 이 되지 않는다")
    void concurrentCreateYieldsOneAndConflicts() throws Exception {
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<String>> results = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                results.add(
                        pool.submit(
                                () -> {
                                    ready.countDown();
                                    go.await();
                                    try {
                                        commandService.create(admin.getId(), request("제목", "본문"));
                                        return "CREATED";
                                    } catch (BusinessException e) {
                                        return e.errorCode().name();
                                    } catch (Exception e) {
                                        return e.getClass().getSimpleName();
                                    }
                                }));
            }
            ready.await();
            go.countDown();
            List<String> outcomes = new ArrayList<>();
            for (Future<String> result : results) {
                outcomes.add(result.get());
            }

            assertThat(outcomes.stream().filter("CREATED"::equals)).hasSize(1);
            assertThat(outcomes.stream().filter(o -> !"CREATED".equals(o)))
                    .hasSize(threads - 1)
                    .containsOnly("CONFLICT");
            assertThat(notificationTemplateRepository.count()).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    // ───────────── PUT ─────────────

    @Test
    @DisplayName("ADMIN 이 템플릿을 수정한다 — 200, 값과 수정자가 바뀌고 조건은 그대로 자기 자신과 충돌하지 않는다")
    void adminUpdatesTemplate() {
        var created = createTemplate();
        Account other = account(SystemRole.ADMIN);

        var response =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(),
                        HttpMethod.PUT,
                        new HttpEntity<>(
                                request("새 제목", "<p>새 본문 {{nickname}}</p>"), headersOf(other)),
                        NotificationTemplateResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var body = response.getBody();
        assertThat(body.id()).isEqualTo(created.id());
        assertThat(body.subject()).isEqualTo("새 제목");
        assertThat(body.body()).isEqualTo("<p>새 본문 {{nickname}}</p>");
        assertThat(body.channel()).isEqualTo("EMAIL");
        assertThat(body.updatedByAdminId()).isEqualTo(other.getId());
        assertThat(body.updatedAt()).isAfterOrEqualTo(created.updatedAt());

        NotificationTemplate saved =
                notificationTemplateRepository.findById(created.id()).orElseThrow();
        assertThat(saved.getSubject()).isEqualTo("새 제목");
        assertThat(saved.getUpdatedByAdminId()).isEqualTo(other.getId());
    }

    @Test
    @DisplayName("다른 템플릿이 쓰는 조건으로 바꾸려 하면 수정이 409 CONFLICT — 값은 그대로")
    void updateRejectsConditionTakenByAnotherTemplate() {
        var created = createTemplate();
        seedStudyNotice();

        var response =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(),
                        HttpMethod.PUT,
                        asAdmin(
                                new NotificationTemplateRequest(
                                        NotificationEventType.STUDY_NOTICE, "옮김", "옮긴 본문")),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
        NotificationTemplate saved =
                notificationTemplateRepository.findById(created.id()).orElseThrow();
        assertThat(saved.getEventType()).isEqualTo(NotificationEventType.USER_REGISTERED);
        assertThat(saved.getSubject()).isEqualTo("환영합니다");
    }

    @Test
    @DisplayName("조건은 그대로 두고 수정하면 다른 조건의 템플릿이 있어도 200 — 자기 자신과는 충돌하지 않는다")
    void updateKeepingConditionIgnoresOtherConditions() {
        var created = createTemplate();
        seedStudyNotice();

        var response =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(),
                        HttpMethod.PUT,
                        asAdmin(request("새 제목", "새 본문")),
                        NotificationTemplateResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().subject()).isEqualTo("새 제목");
    }

    @Test
    @DisplayName("비어 있는 조건으로는 옮길 수 있고, 옮기면 원래 조건이 비어 다시 추가할 수 있다")
    void updateMovesTemplateToFreeCondition() {
        var created = createTemplate();

        var moved =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(),
                        HttpMethod.PUT,
                        asAdmin(
                                new NotificationTemplateRequest(
                                        NotificationEventType.STUDY_NOTICE, "옮김", "옮긴 본문")),
                        NotificationTemplateResponse.class);
        assertThat(moved.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(moved.getBody().eventType()).isEqualTo("STUDY_NOTICE");

        createTemplate(); // USER_REGISTERED 가 비어 있으니 추가된다
        assertThat(notificationTemplateRepository.count()).isEqualTo(2);
    }

    @Test
    @DisplayName("스터디 공지 조건도 같은 규칙이다 — 없으면 추가되고 이미 있으면 409")
    void studyNoticeFollowsSameRule() {
        var request =
                new NotificationTemplateRequest(
                        NotificationEventType.STUDY_NOTICE, "[StudyClub] 공지", "본문");

        var first =
                testRestTemplate.exchange(
                        PATH,
                        HttpMethod.POST,
                        asAdmin(request),
                        NotificationTemplateResponse.class);
        var second = testRestTemplate.exchange(PATH, HttpMethod.POST, asAdmin(request), Map.class);

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(first.getBody().eventType()).isEqualTo("STUDY_NOTICE");
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("없는 템플릿을 수정하면 404 NOT_FOUND")
    void updateUnknownIdIsNotFound() {
        var response =
                testRestTemplate.exchange(
                        PATH + "/999999", HttpMethod.PUT, asAdmin(request("제목", "본문")), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("수정도 같은 검증을 받는다 — 빈 제목은 400 이고 저장된 값은 그대로")
    void updateRejectsInvalidInput() {
        var created = createTemplate();

        var response =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(),
                        HttpMethod.PUT,
                        asAdmin(request("", "본문")),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(notificationTemplateRepository.findById(created.id()).orElseThrow().getSubject())
                .isEqualTo("환영합니다");
    }

    // ───────────── DELETE ─────────────

    @Test
    @DisplayName("ADMIN 이 템플릿을 지운다 — 204, 목록에서 빠지고 발송 이력은 남는다")
    void adminDeletesTemplateAndKeepsHistory() {
        var created = createTemplate();
        Notification history =
                notificationRepository.save(
                        Notification.pendingImmediate(
                                NotificationEventType.USER_REGISTERED,
                                NotificationChannel.EMAIL,
                                "hello@example.com",
                                null,
                                created.id(),
                                Map.of("nickname", "홍길동")));

        var response =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(), HttpMethod.DELETE, asAdmin(null), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(notificationTemplateRepository.findById(created.id())).isEmpty();
        var list =
                testRestTemplate.exchange(
                        PATH, HttpMethod.GET, asAdmin(null), NotificationTemplateResponse[].class);
        assertThat(list.getBody()).isEmpty();
        assertThat(notificationRepository.findById(history.getId())).isPresent();
    }

    @Test
    @DisplayName("없는 템플릿을 지우면 404 NOT_FOUND — 두 번 지우면 두 번째가 404")
    void deleteUnknownIdIsNotFound() {
        var created = createTemplate();
        testRestTemplate.exchange(
                PATH + "/" + created.id(), HttpMethod.DELETE, asAdmin(null), Void.class);

        var response =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(), HttpMethod.DELETE, asAdmin(null), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    // ───────────── 인가 ─────────────

    @Test
    @DisplayName("MEMBER 는 추가·수정·삭제가 403 FORBIDDEN 이고 아무것도 바뀌지 않는다")
    void memberIsForbidden() {
        var created = createTemplate();
        var member = new HttpHeaders();
        member.putAll(headersOf(account(SystemRole.MEMBER)));

        var post =
                testRestTemplate.exchange(
                        PATH,
                        HttpMethod.POST,
                        new HttpEntity<>(request("제목", "본문"), member),
                        Map.class);
        var put =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(),
                        HttpMethod.PUT,
                        new HttpEntity<>(request("바꿈", "바꿈"), member),
                        Map.class);
        var delete =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(),
                        HttpMethod.DELETE,
                        new HttpEntity<>(member),
                        Map.class);

        for (var response : java.util.List.of(post, put, delete)) {
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
        }
        NotificationTemplate saved =
                notificationTemplateRepository.findById(created.id()).orElseThrow();
        assertThat(saved.getSubject()).isEqualTo("환영합니다");
    }

    @Test
    @DisplayName("토큰이 없으면 추가·수정·삭제가 401 UNAUTHORIZED")
    void unauthenticatedIsRejected() {
        var created = createTemplate();
        var none = new HttpHeaders();

        var post =
                testRestTemplate.exchange(
                        PATH,
                        HttpMethod.POST,
                        new HttpEntity<>(request("제목", "본문"), none),
                        Map.class);
        var put =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(),
                        HttpMethod.PUT,
                        new HttpEntity<>(request("제목", "본문"), none),
                        Map.class);
        var delete =
                testRestTemplate.exchange(
                        PATH + "/" + created.id(),
                        HttpMethod.DELETE,
                        new HttpEntity<>(none),
                        Map.class);

        for (var response : java.util.List.of(post, put, delete)) {
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
        }
    }
}
