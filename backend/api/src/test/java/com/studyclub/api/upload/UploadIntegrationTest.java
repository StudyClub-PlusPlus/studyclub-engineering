package com.studyclub.api.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.studyclub.api.auth.JwtService;
import com.studyclub.api.storage.ObjectStorage;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.storage.StorageObject;
import com.studyclub.domain.storage.StorageObjectRepository;
import com.studyclub.domain.storage.StorageObjectStatus;
import com.studyclub.domain.storage.StoragePurpose;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/** POST /api/uploads/images (specs/profile-image/spec.md). 저장소는 가짜 — 넘어간 바이트와 호출만 본다. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.datasource.url=jdbc:h2:mem:upload;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "upload.pending-limit=3"
        })
@AutoConfigureTestRestTemplate
class UploadIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired StorageObjectRepository storageObjectRepository;
    @MockitoBean ObjectStorage storage;

    Map<String, byte[]> stored;

    @BeforeEach
    void stubStorage() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        stored = UploadTestSupport.stubInMemory(storage);
    }

    private Account seedOnboardedAccount() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Account account =
                accountRepository.save(
                        new Account(
                                "up-" + suffix + "@example.com",
                                "account_" + suffix,
                                null,
                                SystemRole.MEMBER));
        account.completeOnboarding("n" + suffix, "Asia/Seoul", Instant.now());
        return accountRepository.save(account);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> upload(Account account, byte[] file, String purpose) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        if (account != null) {
            headers.setBearerAuth(
                    jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        }
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        if (file != null) {
            body.add(
                    "file",
                    new ByteArrayResource(file) {
                        @Override
                        public String getFilename() {
                            return "photo.jpg";
                        }
                    });
        }
        if (purpose != null) {
            body.add("purpose", purpose);
        }
        return rest.postForEntity(
                "/api/uploads/images", new HttpEntity<>(body, headers), Map.class);
    }

    @Test
    @DisplayName("성공 - 201 { fileId, url }, 행은 PENDING, 저장소에 넘어간 바이트에 GPS 가 없다")
    void uploadsAndStripsMetadata() {
        Account account = seedOnboardedAccount();

        var response = upload(account, UploadTestSupport.jpegWithGps(), "PROFILE");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long fileId = ((Number) response.getBody().get("fileId")).longValue();
        String url = (String) response.getBody().get("url");
        StorageObject saved = storageObjectRepository.findById(fileId).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(StorageObjectStatus.PENDING);
        assertThat(saved.getAccountId()).isEqualTo(account.getId());
        assertThat(saved.getPurpose()).isEqualTo(StoragePurpose.PROFILE);
        assertThat(saved.getObjectKey()).startsWith("gigs/profiles/").endsWith(".jpg");
        assertThat(saved.getContentType()).isEqualTo("image/jpeg");
        assertThat(url).isEqualTo(UploadTestSupport.BASE_URL + "/" + saved.getObjectKey());
        byte[] sent = stored.get(saved.getObjectKey());
        assertThat(sent).isNotNull();
        assertThat(new String(sent, StandardCharsets.ISO_8859_1)).doesNotContain("GPS");
        assertThat(saved.getSize()).isEqualTo(sent.length);
    }

    @Test
    @DisplayName("실패 - 이름만 .jpg 인 텍스트는 400")
    void rejectsTextFile() {
        var response =
                upload(seedOnboardedAccount(), "hello".getBytes(StandardCharsets.UTF_8), "PROFILE");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(response.getBody())
                .containsEntry("errorMessage", "jpeg, png, webp 파일만 올릴 수 있습니다.");
        assertThat(stored).isEmpty();
    }

    @Test
    @DisplayName("실패 - 빈 파일 · 파일 없음은 400")
    void rejectsEmptyFile() {
        Account account = seedOnboardedAccount();

        assertThat(upload(account, new byte[0], "PROFILE").getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        var missing = upload(account, null, "PROFILE");
        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(missing.getBody()).containsEntry("errorMessage", "파일이 비어 있습니다.");
    }

    @Test
    @DisplayName("실패 - purpose 없음 · 모르는 값은 400")
    void rejectsBadPurpose() {
        Account account = seedOnboardedAccount();
        byte[] jpeg = UploadTestSupport.jpegWithGps();

        var missing = upload(account, jpeg, null);
        var unknown = upload(account, jpeg, "BANNER");

        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(unknown.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(unknown.getBody()).containsEntry("errorMessage", "용도가 올바르지 않습니다.");
    }

    @Test
    @DisplayName("실패 - 깨진 jpeg(세그먼트 길이가 파일을 넘음)는 400, 저장소에 올리지 않는다")
    void rejectsBrokenImage() {
        byte[] broken = {
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE1, 0x7F, (byte) 0xFF, 1, 2
        };

        var response = upload(seedOnboardedAccount(), broken, "PROFILE");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorMessage", "이미지를 읽을 수 없습니다.");
        assertThat(stored).isEmpty();
    }

    @Test
    @DisplayName("실패 - 연결 안 한 파일이 상한(테스트 3)이면 400")
    void rejectsWhenTooManyPending() {
        Account account = seedOnboardedAccount();
        byte[] jpeg = UploadTestSupport.jpegWithGps();
        for (int i = 0; i < 3; i++) {
            assertThat(upload(account, jpeg, "PROFILE").getStatusCode())
                    .isEqualTo(HttpStatus.CREATED);
        }

        var response = upload(account, jpeg, "PROFILE");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody())
                .containsEntry("errorMessage", "올린 뒤 쓰지 않은 사진이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    }

    @Test
    @DisplayName("실패 - 저장소 설정이 없으면 503")
    void returns503WhenStorageNotConfigured() {
        when(storage.isConfigured()).thenReturn(false);

        var response = upload(seedOnboardedAccount(), UploadTestSupport.jpegWithGps(), "PROFILE");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).containsEntry("errorCode", "EXTERNAL_SERVICE_ERROR");
    }

    @Test
    @DisplayName("실패 - 토큰 없음 401, 온보딩 미완료 403")
    void requiresOnboardedMember() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Account notOnboarded =
                accountRepository.save(
                        new Account(
                                "raw-" + suffix + "@example.com",
                                "account_" + suffix,
                                null,
                                SystemRole.MEMBER));

        assertThat(upload(null, UploadTestSupport.jpegWithGps(), "PROFILE").getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(upload(notOnboarded, UploadTestSupport.jpegWithGps(), "PROFILE").getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }
}
