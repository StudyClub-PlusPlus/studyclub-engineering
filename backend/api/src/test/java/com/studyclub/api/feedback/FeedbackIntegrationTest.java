package com.studyclub.api.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.studyclub.api.auth.AccountDeletionService;
import com.studyclub.api.auth.JwtService;
import com.studyclub.api.storage.ObjectStorage;
import com.studyclub.api.upload.UploadTestSupport;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.LeaveReason;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.feedback.Feedback;
import com.studyclub.domain.feedback.FeedbackImageRepository;
import com.studyclub.domain.feedback.FeedbackRepository;
import com.studyclub.domain.feedback.FeedbackStatus;
import com.studyclub.domain.feedback.FeedbackType;
import com.studyclub.domain.storage.StorageObjectRepository;
import com.studyclub.domain.storage.StorageObjectStatus;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
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
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/**
 * 문의·오류 신고 — 제출 · 내 문의 · 운영 목록 · 상세 · 처리 · 탈퇴 (specs/feedback/spec.md). 저장소는 가짜다.
 *
 * <p>테스트마다 새 계정을 만든다 — rate limit(60초 1건)이 계정 단위라 한 계정이 여러 건을 가져야 하면 저장소로 넣고 접수 시각을 과거로 옮긴다. 운영 목록은
 * 다른 테스트의 행과 섞이므로 제목의 고유 토큰으로 걸러 본다.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"spring.datasource.url=jdbc:h2:mem:feedback;MODE=MySQL;DB_CLOSE_DELAY=-1"})
@AutoConfigureTestRestTemplate
class FeedbackIntegrationTest {

    private static final String CHROME_MAC =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)"
                    + " Chrome/141.0.0.0 Safari/537.36";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired FeedbackRepository feedbackRepository;
    @Autowired FeedbackImageRepository feedbackImageRepository;
    @Autowired StorageObjectRepository storageObjectRepository;
    @Autowired AccountDeletionService accountDeletionService;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ObjectStorage storage;
    @Autowired com.studyclub.notification.NotificationTemplateRepository templates;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        UploadTestSupport.stubInMemory(storage);
        if (templates
                .findAllByEventTypeAndChannelOrderByIdAsc(
                        com.studyclub.notification.NotificationEventType.FEEDBACK_REPLIED,
                        com.studyclub.notification.NotificationChannel.EMAIL)
                .isEmpty()) {
            templates.save(
                    new com.studyclub.notification.NotificationTemplate(
                            com.studyclub.notification.NotificationEventType.FEEDBACK_REPLIED,
                            com.studyclub.notification.NotificationChannel.EMAIL,
                            "문의 답변 등록",
                            "{{nickname}} {{feedbackUrl}}"));
        }
    }

    // ---- 도우미 -------------------------------------------------------------------------------

    private static String token() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    private Account seedAccount(SystemRole role, boolean onboarded) {
        String suffix = token();
        Account account =
                accountRepository.save(
                        new Account(
                                "fb-" + suffix + "@example.com", "account_" + suffix, null, role));
        if (onboarded) {
            account.completeOnboarding("n" + suffix, "Asia/Seoul", Instant.now());
        }
        return accountRepository.save(account);
    }

    private Account crew() {
        return seedAccount(SystemRole.MEMBER, true);
    }

    private Account captain() {
        return seedAccount(SystemRole.ADMIN, true);
    }

    private HttpHeaders bearer(Account account) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return headers;
    }

    private Long upload(Account account, String purpose) {
        HttpHeaders headers = bearer(account);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add(
                "file",
                new ByteArrayResource(UploadTestSupport.jpegWithGps()) {
                    @Override
                    public String getFilename() {
                        return "shot.jpg";
                    }
                });
        body.add("purpose", purpose);
        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> response =
                rest.postForEntity(
                        "/api/uploads/images", new HttpEntity<>(body, headers), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return ((Number) response.getBody().get("fileId")).longValue();
    }

    private static Map<String, Object> body(String title, List<Long> imageFileIds) {
        Map<String, Object> body = new HashMap<>();
        body.put("type", "BUG");
        body.put("title", title);
        body.put("content", "아이폰 사파리에서 출석 버튼을 눌러도 반응이 없습니다.");
        body.put("imageFileIds", imageFileIds);
        body.put("viewport", Map.of("width", 390, "height", 844));
        return body;
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> submit(Account account, Map<String, Object> body) {
        HttpHeaders headers = bearer(account);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.USER_AGENT, CHROME_MAC);
        return rest.postForEntity("/api/feedbacks", new HttpEntity<>(body, headers), Map.class);
    }

    /** {@code {q}} 같은 자리에 값을 넣는다 — 검색어의 공백 · {@code %} 를 인코딩에 맡긴다. */
    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> get(Account account, String path, Object... uriVariables) {
        return rest.exchange(
                path, HttpMethod.GET, new HttpEntity<>(bearer(account)), Map.class, uriVariables);
    }

    private static Map<String, Object> withdrawnPerson() {
        Map<String, Object> person = new HashMap<>();
        person.put("nickname", null);
        return person;
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> patch(Account account, Long feedbackId, Map<String, Object> body) {
        HttpHeaders headers = bearer(account);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(
                "/api/admin/feedbacks/" + feedbackId,
                HttpMethod.PATCH,
                new HttpEntity<>(body, headers),
                Map.class);
    }

    /** rate limit 을 피해 한 계정에 여러 건 — 저장소로 넣고 접수 시각을 옮긴다. */
    private Feedback seedFeedback(Account account, FeedbackType type, String title, Instant at) {
        Feedback feedback =
                feedbackRepository.save(
                        new Feedback(
                                account.getId(),
                                type,
                                title,
                                "내용은 열 글자를 넘겨야 합니다.",
                                null,
                                null,
                                null));
        jdbc.update(
                "UPDATE FEEDBACK SET CREATED_AT = ? WHERE ID = ?",
                Timestamp.from(at),
                feedback.getId());
        return feedback;
    }

    private static Long id(ResponseEntity<?> response) {
        return ((Number) ((Map<?, ?>) response.getBody()).get("id")).longValue();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(ResponseEntity<Map> response) {
        return (List<Map<String, Object>>) response.getBody().get("items");
    }

    // ---- 제출 ---------------------------------------------------------------------------------

    @Test
    @DisplayName("제출 — 201 접수. 이미지가 이어지고, 브라우저는 줄인 값 · 화면 크기와 함께 운영 상세에 보인다")
    void submitWithImage() {
        Account crew = crew();
        Long fileId = upload(crew, "FEEDBACK");

        var response = submit(crew, body("출석 버튼 " + token(), List.of(fileId)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsEntry("status", "RECEIVED");
        Long feedbackId = id(response);
        assertThat(storageObjectRepository.findById(fileId).orElseThrow().getStatus())
                .isEqualTo(StorageObjectStatus.ATTACHED);

        var mine = get(crew, "/api/me/feedbacks/" + feedbackId);
        assertThat(mine.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(mine.getBody()).containsEntry("reply", null);
        assertThat(mine.getBody()).doesNotContainKeys("adminMemo", "browser", "viewport");
        assertThat((List<?>) mine.getBody().get("images")).hasSize(1);

        var admin = get(captain(), "/api/admin/feedbacks/" + feedbackId);
        assertThat(admin.getBody()).containsEntry("browser", "Chrome 141 · macOS");
        assertThat(admin.getBody()).containsEntry("viewport", Map.of("width", 390, "height", 844));
        assertThat(admin.getBody()).containsEntry("status", "NEW");
        assertThat(admin.getBody().get("selectableStatuses")).isEqualTo(List.of("NEW", "SEEN"));
    }

    @Test
    @DisplayName("제출 — 내용은 문자 그대로 저장한다 (HTML 을 지우거나 바꾸지 않는다)")
    void contentIsStoredAsIs() {
        Account crew = crew();
        Map<String, Object> body = body("태그 " + token(), List.of());
        body.put("content", "카드에 <b>마감</b> 이 그대로 보여요\n두 번째 줄");

        Long feedbackId = id(submit(crew, body));

        assertThat(get(crew, "/api/me/feedbacks/" + feedbackId).getBody())
                .containsEntry("content", "카드에 <b>마감</b> 이 그대로 보여요\n두 번째 줄");
    }

    @Test
    @DisplayName("제출 — 길이 · 유형 · 장수 · 화면 크기가 틀리면 400 이고 아무것도 남지 않는다")
    void submitValidation() {
        Account crew = crew();
        long before = feedbackRepository.count();

        Map<String, Object> shortTitle = body("가", List.of());
        Map<String, Object> blankPadded = body("  " + "가" + "  ", List.of());
        Map<String, Object> noType = body("유형 없음", List.of());
        noType.remove("type");
        Map<String, Object> badType = body("모르는 유형", List.of());
        badType.put("type", "PRAISE");
        Map<String, Object> tooMany = body("네 장", List.of(1L, 2L, 3L, 4L));
        Map<String, Object> duplicated = body("중복", List.of(1L, 1L));
        Map<String, Object> badViewport = body("화면", List.of());
        badViewport.put("viewport", Map.of("width", 0, "height", 844));

        for (Map<String, Object> invalid :
                List.of(
                        shortTitle,
                        blankPadded,
                        noType,
                        badType,
                        tooMany,
                        duplicated,
                        badViewport)) {
            var response = submit(crew, invalid);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
        assertThat(feedbackRepository.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("제출 — 다른 용도로 올린 이미지는 이을 수 없다. 400 이고 문의도 남지 않는다")
    void otherPurposeImageRollsBack() {
        Account crew = crew();
        Long profileFile = upload(crew, "PROFILE");
        String title = "용도 " + token();

        var response = submit(crew, body(title, List.of(profileFile)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get(crew, "/api/me/feedbacks").getBody()).containsEntry("total", 0);
    }

    @Test
    @DisplayName("rate limit — 60초 안에 두 번째는 429 TOO_MANY_REQUESTS")
    void tooSoon() {
        Account crew = crew();
        assertThat(submit(crew, body("첫 번째 " + token(), List.of())).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);

        var second = submit(crew, body("두 번째 " + token(), List.of()));

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(second.getBody()).containsEntry("errorCode", "TOO_MANY_REQUESTS");
    }

    @Test
    @DisplayName("rate limit — 24시간 안에 20건을 보냈으면 429. 하루가 지난 건은 세지 않는다")
    void dailyLimit() {
        Account crew = crew();
        Instant now = Instant.now();
        for (int i = 0; i < 19; i++) {
            seedFeedback(crew, FeedbackType.IDEA, "의견 " + i, now.minus(Duration.ofHours(2)));
        }
        seedFeedback(crew, FeedbackType.IDEA, "어제 의견", now.minus(Duration.ofHours(25)));
        assertThat(submit(crew, body("스무 번째 " + token(), List.of())).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        jdbc.update(
                "UPDATE FEEDBACK SET CREATED_AT = ? WHERE ACCOUNT_ID = ? AND CREATED_AT > ?",
                Timestamp.from(now.minus(Duration.ofHours(1))),
                crew.getId(),
                Timestamp.from(now.minus(Duration.ofMinutes(5))));

        var response = submit(crew, body("스물한 번째 " + token(), List.of()));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    @DisplayName("온보딩 전 계정은 403 ONBOARDING_REQUIRED, 토큰 없으면 401")
    void requiresOnboarding() {
        Account notOnboarded = seedAccount(SystemRole.MEMBER, false);

        var response = submit(notOnboarded, body("온보딩 " + token(), List.of()));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "ONBOARDING_REQUIRED");
        assertThat(get(notOnboarded, "/api/me/feedbacks").getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> anonymous = rest.getForEntity("/api/me/feedbacks", Map.class);
        assertThat(anonymous.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ---- 내 문의 -------------------------------------------------------------------------------

    @Test
    @DisplayName("내 문의 — 본인 것만, 접수 시각 내림차순. 남의 것 · 없는 번호는 404")
    void myFeedbacksAreMineOnly() {
        Account crew = crew();
        Account other = crew();
        Instant now = Instant.now();
        Feedback older = seedFeedback(crew, FeedbackType.IDEA, "오래된 의견", now.minusSeconds(3600));
        Feedback newer = seedFeedback(crew, FeedbackType.QUESTION, "새 문의", now.minusSeconds(600));
        Feedback othersFeedback = seedFeedback(other, FeedbackType.BUG, "남의 신고", now);

        var list = get(crew, "/api/me/feedbacks");
        assertThat(list.getBody()).containsEntry("total", 2);
        assertThat(items(list))
                .extracting(item -> ((Number) item.get("id")).longValue())
                .containsExactly(newer.getId(), older.getId());

        var page = get(crew, "/api/me/feedbacks?offset=1&limit=1");
        assertThat(items(page)).hasSize(1);
        assertThat(get(crew, "/api/me/feedbacks?offset=5").getBody()).containsEntry("total", 2);
        assertThat(get(crew, "/api/me/feedbacks?limit=0").getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        var others = get(crew, "/api/me/feedbacks/" + othersFeedback.getId());
        assertThat(others.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(get(crew, "/api/me/feedbacks/999999999").getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ---- 운영 ---------------------------------------------------------------------------------

    @Test
    @DisplayName("운영 목록 — 캡틴만. 유형 · 상태 · 검색(제목·내용, %·_ 는 글자)으로 거르고 total 은 걸러진 뒤 수")
    void adminList() {
        Account crew = crew();
        Account captain = captain();
        String tag = token();
        Instant now = Instant.now();
        seedFeedback(crew, FeedbackType.BUG, tag + " 버그 100%", now.minusSeconds(30));
        seedFeedback(crew, FeedbackType.IDEA, tag + " 의견", now.minusSeconds(20));
        Feedback seen =
                seedFeedback(crew, FeedbackType.IDEA, tag + " 확인한 의견", now.minusSeconds(10));
        seen.changeStatus(FeedbackStatus.SEEN);
        feedbackRepository.save(seen);

        assertThat(get(crew, "/api/admin/feedbacks").getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        var all = get(captain, "/api/admin/feedbacks?q={q}", tag);
        assertThat(all.getBody()).containsEntry("total", 3);
        Map<String, Object> first = items(all).get(0);
        assertThat(first).containsEntry("title", tag + " 확인한 의견");
        assertThat(first).containsEntry("submitter", Map.of("nickname", crew.getNickname()));
        assertThat(first).containsEntry("doneBy", null);

        assertThat(get(captain, "/api/admin/feedbacks?q={q}&type=IDEA", tag).getBody())
                .containsEntry("total", 2);
        assertThat(get(captain, "/api/admin/feedbacks?q={q}&status=SEEN", tag).getBody())
                .containsEntry("total", 1);
        assertThat(get(captain, "/api/admin/feedbacks?q={q}", tag + " 버그 100%").getBody())
                .containsEntry("total", 1);
        // 「_」 가 와일드카드였다면 「tag + 공백」 으로 시작하는 세 건이 다 걸린다
        assertThat(get(captain, "/api/admin/feedbacks?q={q}", tag + "_").getBody())
                .containsEntry("total", 0);
        assertThat(get(captain, "/api/admin/feedbacks?type=PRAISE").getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("처리 — 미확인↔확인, 회신 없이 완료는 409, 첫 회신이 완료 + 처리자, 회신 뒤 상태 변경은 409, 회신 수정은 내용만")
    void adminPatchFlow() {
        Account crew = crew();
        Account captain = captain();
        Long feedbackId = id(submit(crew, body("처리 흐름 " + token(), List.of())));

        var seen = patch(captain, feedbackId, Map.of("status", "SEEN"));
        assertThat(seen.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(seen.getBody()).containsEntry("status", "SEEN");

        var done = patch(captain, feedbackId, Map.of("status", "DONE"));
        assertThat(done.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(done.getBody()).containsEntry("errorCode", "FEEDBACK_REPLY_REQUIRED");

        var replied = patch(captain, feedbackId, Map.of("reply", "디스코드 채널에 남겨 주세요."));
        assertThat(replied.getBody()).containsEntry("status", "DONE");
        assertThat(replied.getBody())
                .containsEntry("doneBy", Map.of("nickname", captain.getNickname()));
        assertThat(replied.getBody().get("selectableStatuses")).isEqualTo(List.of());
        Object repliedAt = ((Map<?, ?>) replied.getBody().get("reply")).get("repliedAt");

        var locked = patch(captain, feedbackId, Map.of("status", "NEW"));
        assertThat(locked.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(locked.getBody()).containsEntry("errorCode", "FEEDBACK_ALREADY_ANSWERED");

        var edited = patch(captain(), feedbackId, Map.of("reply", "고친 회신 — 링크를 더했어요."));
        Map<?, ?> reply = (Map<?, ?>) edited.getBody().get("reply");
        assertThat(reply.get("content")).isEqualTo("고친 회신 — 링크를 더했어요.");
        assertThat(reply.get("repliedAt")).isEqualTo(repliedAt);
        assertThat(edited.getBody())
                .containsEntry("doneBy", Map.of("nickname", captain.getNickname()));

        var mine = get(crew, "/api/me/feedbacks/" + feedbackId);
        assertThat(mine.getBody()).containsEntry("status", "ANSWERED");
        assertThat(((Map<?, ?>) mine.getBody().get("reply")).get("content"))
                .isEqualTo("고친 회신 — 링크를 더했어요.");
    }

    @Test
    @DisplayName("처리 — 키가 없거나 둘이거나 값이 null 이면 400. 메모는 저장되고 \"\" 이면 지워진다. 회신은 10자 이상")
    void adminPatchValidation() {
        Account captain = captain();
        Long feedbackId = id(submit(crew(), body("메모 " + token(), List.of())));

        Map<String, Object> nullValue = new HashMap<>();
        nullValue.put("adminMemo", null);
        for (Map<String, Object> invalid :
                List.of(
                        Map.<String, Object>of(),
                        Map.<String, Object>of("status", "SEEN", "adminMemo", "둘"),
                        nullValue,
                        Map.<String, Object>of("status", "LATER"),
                        Map.<String, Object>of("reply", "짧아요"))) {
            var response = patch(captain, feedbackId, invalid);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }

        assertThat(patch(captain, feedbackId, Map.of("adminMemo", "이스케이프 누락 의심")).getBody())
                .containsEntry("adminMemo", "이스케이프 누락 의심");
        assertThat(patch(captain, feedbackId, Map.of("adminMemo", "")).getBody())
                .containsEntry("adminMemo", null);
        assertThat(get(captain, "/api/admin/feedbacks/999999999").getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ---- 탈퇴 ---------------------------------------------------------------------------------

    @Test
    @DisplayName("탈퇴 — 첨부 이미지는 파일 · 행까지 지우고, 문의는 남아 「탈퇴한 사용자」(nickname null) 로 보인다")
    void leaveDeletesImagesKeepsFeedback() {
        Account crew = crew();
        Account captain = captain();
        Long fileId = upload(crew, "FEEDBACK");
        String objectKey = storageObjectRepository.findById(fileId).orElseThrow().getObjectKey();
        String title = "탈퇴 " + token();
        Long feedbackId = id(submit(crew, body(title, List.of(fileId))));

        accountDeletionService.deleteAccount(crew.getId(), LeaveReason.OTHER);

        assertThat(feedbackImageRepository.findAllByFeedbackIdOrderByDisplayOrderAsc(feedbackId))
                .isEmpty();
        assertThat(storageObjectRepository.findById(fileId)).isEmpty();
        verify(storage).delete(objectKey);
        assertThat(feedbackRepository.findById(feedbackId)).isPresent();

        var list = get(captain, "/api/admin/feedbacks?q={q}", title);
        assertThat(items(list).get(0)).containsEntry("submitter", withdrawnPerson());
        assertThat(get(captain, "/api/admin/feedbacks/" + feedbackId).getBody())
                .containsEntry("submitter", withdrawnPerson())
                .containsEntry("images", List.of());
    }
}
