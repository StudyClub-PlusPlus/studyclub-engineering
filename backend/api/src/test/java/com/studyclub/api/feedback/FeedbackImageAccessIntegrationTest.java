package com.studyclub.api.feedback;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.api.storage.ObjectStorage;
import com.studyclub.api.upload.UploadTestSupport;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.feedback.FeedbackImageRepository;
import com.studyclub.domain.storage.StorageObject;
import com.studyclub.domain.storage.StorageObjectRepository;
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

/** 문의 첨부 이미지 접근 제한 (specs/feedback/spec.md 「첨부 이미지 열기」). 저장소는 가짜다. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.datasource.url=jdbc:h2:mem:feedbackimage;MODE=MySQL;DB_CLOSE_DELAY=-1"
        })
@AutoConfigureTestRestTemplate
class FeedbackImageAccessIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired FeedbackImageRepository feedbackImageRepository;
    @Autowired StorageObjectRepository storageObjectRepository;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ObjectStorage storage;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        UploadTestSupport.stubInMemory(storage);
    }

    private Account seed(SystemRole role) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Account account =
                accountRepository.save(
                        new Account(
                                "fi-" + suffix + "@example.com", "account_" + suffix, null, role));
        account.completeOnboarding("n" + suffix, "Asia/Seoul", Instant.now());
        return accountRepository.save(account);
    }

    private HttpHeaders bearer(Account account) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return headers;
    }

    private Long upload(Account account) {
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
        body.add("purpose", "FEEDBACK");
        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> response =
                rest.postForEntity(
                        "/api/uploads/images", new HttpEntity<>(body, headers), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().get("url")).as("비공개 용도는 공개 주소가 없다").isNull();
        return ((Number) response.getBody().get("fileId")).longValue();
    }

    /** 사진 한 장을 붙인 문의를 낸다. */
    @SuppressWarnings("rawtypes")
    private Long submitWithImage(Account author) {
        Long fileId = upload(author);
        Map<String, Object> body = new HashMap<>();
        body.put("type", "BUG");
        body.put("title", "첨부 접근 " + UUID.randomUUID());
        body.put("content", "스크린샷에 이메일이 찍혀 있습니다.");
        body.put("imageFileIds", List.of(fileId));
        HttpHeaders headers = bearer(author);
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> response =
                rest.postForEntity("/api/feedbacks", new HttpEntity<>(body, headers), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return ((Number) response.getBody().get("id")).longValue();
    }

    private Long imageId(Long feedbackId) {
        return feedbackImageRepository
                .findAllByFeedbackIdOrderByDisplayOrderAsc(feedbackId)
                .getFirst()
                .getId();
    }

    private ResponseEntity<byte[]> fetch(String path, Account who) {
        HttpHeaders headers = who == null ? new HttpHeaders() : bearer(who);
        return rest.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), byte[].class);
    }

    @Test
    @DisplayName("작성자 - 200, 이미지 바이트 · Content-Type · no-store. 파일은 비공개 폴더에 있다")
    void authorReadsOwnImage() {
        Account author = seed(SystemRole.MEMBER);
        Long feedbackId = submitWithImage(author);
        Long imageId = imageId(feedbackId);

        var response = fetch("/api/me/feedbacks/" + feedbackId + "/images/" + imageId, author);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_JPEG);
        assertThat(response.getHeaders().getCacheControl())
                .contains("no-store")
                .contains("private");
        assertThat(response.getHeaders().getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.getBody()).isNotEmpty();
        StorageObject file =
                storageObjectRepository
                        .findById(
                                feedbackImageRepository
                                        .findById(imageId)
                                        .orElseThrow()
                                        .getStorageObjectId())
                        .orElseThrow();
        assertThat(file.getObjectKey()).startsWith("private/feedbacks/");
    }

    @Test
    @DisplayName("Range 헤더가 와도 범위 응답을 흉내 내지 않고 전체를 200 으로 준다")
    void rangeRequestGetsFullBody() {
        Account author = seed(SystemRole.MEMBER);
        Long feedbackId = submitWithImage(author);
        Long imageId = imageId(feedbackId);
        HttpHeaders headers = bearer(author);
        headers.set(HttpHeaders.RANGE, "bytes=0-1");

        var response =
                rest.exchange(
                        "/api/me/feedbacks/" + feedbackId + "/images/" + imageId,
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        byte[].class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSizeGreaterThan(2);
        assertThat(response.getHeaders().getFirst(HttpHeaders.ACCEPT_RANGES)).isNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    @DisplayName("상세 응답의 images[].url 은 공개 주소가 아니라 API 경로다")
    void detailReturnsApiPath() {
        Account author = seed(SystemRole.MEMBER);
        Long feedbackId = submitWithImage(author);
        Long imageId = imageId(feedbackId);

        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> mine =
                rest.exchange(
                        "/api/me/feedbacks/" + feedbackId,
                        HttpMethod.GET,
                        new HttpEntity<>(bearer(author)),
                        Map.class);
        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> admin =
                rest.exchange(
                        "/api/admin/feedbacks/" + feedbackId,
                        HttpMethod.GET,
                        new HttpEntity<>(bearer(seed(SystemRole.ADMIN))),
                        Map.class);

        assertThat((List<Object>) mine.getBody().get("images"))
                .containsExactly(
                        Map.of(
                                "id",
                                imageId.intValue(),
                                "url",
                                "/api/me/feedbacks/" + feedbackId + "/images/" + imageId));
        assertThat((List<Object>) admin.getBody().get("images"))
                .containsExactly(
                        Map.of(
                                "id",
                                imageId.intValue(),
                                "url",
                                "/api/admin/feedbacks/" + feedbackId + "/images/" + imageId));
    }

    @Test
    @DisplayName("로그인하지 않으면 401")
    void anonymousIs401() {
        Account author = seed(SystemRole.MEMBER);
        Long feedbackId = submitWithImage(author);
        Long imageId = imageId(feedbackId);

        assertThat(
                        fetch("/api/me/feedbacks/" + feedbackId + "/images/" + imageId, null)
                                .getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(
                        fetch("/api/admin/feedbacks/" + feedbackId + "/images/" + imageId, null)
                                .getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("남의 문의 사진은 404 - 있는지조차 알리지 않는다")
    void otherUserGets404() {
        Account author = seed(SystemRole.MEMBER);
        Long feedbackId = submitWithImage(author);
        Long imageId = imageId(feedbackId);

        var response =
                fetch(
                        "/api/me/feedbacks/" + feedbackId + "/images/" + imageId,
                        seed(SystemRole.MEMBER));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("작성자라도 다른 문의의 이미지 번호로는 404")
    void imageOfAnotherFeedbackIs404() {
        Account author = seed(SystemRole.MEMBER);
        Long mineFeedbackId = submitWithImage(author);
        Long otherImageId = imageId(submitWithImage(seed(SystemRole.MEMBER)));

        var response =
                fetch("/api/me/feedbacks/" + mineFeedbackId + "/images/" + otherImageId, author);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("캡틴 - 어느 문의의 사진이든 200, 캡틴이 아니면 403")
    void captainReadsAndCrewIsForbidden() {
        Account author = seed(SystemRole.MEMBER);
        Long feedbackId = submitWithImage(author);
        Long imageId = imageId(feedbackId);
        String path = "/api/admin/feedbacks/" + feedbackId + "/images/" + imageId;

        assertThat(fetch(path, seed(SystemRole.ADMIN)).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(fetch(path, author).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("캡틴 권한을 잃으면 같은 토큰으로 바로 403")
    void demotedCaptainIsForbiddenImmediately() {
        Account author = seed(SystemRole.MEMBER);
        Long feedbackId = submitWithImage(author);
        Long imageId = imageId(feedbackId);
        Account captain = seed(SystemRole.ADMIN);
        String path = "/api/admin/feedbacks/" + feedbackId + "/images/" + imageId;
        assertThat(fetch(path, captain).getStatusCode()).isEqualTo(HttpStatus.OK);

        jdbc.update("UPDATE ACCOUNT SET SYSTEM_ROLE = 'MEMBER' WHERE ID = ?", captain.getId());

        assertThat(fetch(path, captain).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("보유 기간이 지난 문의의 사진은 배치가 지우기 전이어도 404")
    void expiredRetentionIs404() {
        Account author = seed(SystemRole.MEMBER);
        Long feedbackId = submitWithImage(author);
        Long imageId = imageId(feedbackId);
        jdbc.update(
                "UPDATE FEEDBACK SET EXPIRES_AT = ? WHERE ID = ?",
                Timestamp.from(Instant.now().minus(Duration.ofMinutes(1))),
                feedbackId);

        assertThat(
                        fetch("/api/me/feedbacks/" + feedbackId + "/images/" + imageId, author)
                                .getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(
                        fetch(
                                        "/api/admin/feedbacks/" + feedbackId + "/images/" + imageId,
                                        seed(SystemRole.ADMIN))
                                .getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("삭제 중인 파일은 404")
    void deletingFileIs404() {
        Account author = seed(SystemRole.MEMBER);
        Long feedbackId = submitWithImage(author);
        Long imageId = imageId(feedbackId);
        Long fileId = feedbackImageRepository.findById(imageId).orElseThrow().getStorageObjectId();
        jdbc.update("UPDATE STORAGE_OBJECT SET STATUS = 'DELETING' WHERE ID = ?", fileId);

        assertThat(
                        fetch("/api/me/feedbacks/" + feedbackId + "/images/" + imageId, author)
                                .getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }
}
