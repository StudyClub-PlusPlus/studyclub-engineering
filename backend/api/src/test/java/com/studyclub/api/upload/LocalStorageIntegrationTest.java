package com.studyclub.api.upload;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.storage.StorageObjectRepository;
import com.studyclub.domain.storage.StorageProvider;
import java.time.Instant;
import java.util.Map;
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
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/** 키 없이 로컬 저장소로 — 올리기 → 인증 없이 그 주소로 받기 → 연결까지 한 바퀴. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.datasource.url=jdbc:h2:mem:localstorage;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "storage.local.enabled=true",
            "storage.local.dir=build/test-local-storage",
            "storage.local.public-base-url=http://localhost/local-storage"
        })
@AutoConfigureTestRestTemplate
class LocalStorageIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired StorageObjectRepository storageObjectRepository;

    @Test
    @SuppressWarnings("rawtypes")
    void 키_없이_올리고_받고_연결한다() {
        Account account =
                accountRepository.save(
                        new Account("local@example.com", "account_local", null, SystemRole.MEMBER));
        account.completeOnboarding("local", "Asia/Seoul", Instant.now());
        accountRepository.save(account);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add(
                "file",
                new ByteArrayResource(UploadTestSupport.jpegWithGps()) {
                    @Override
                    public String getFilename() {
                        return "photo.jpg";
                    }
                });
        body.add("purpose", "PROFILE");

        ResponseEntity<Map> uploaded =
                rest.postForEntity(
                        "/api/uploads/images", new HttpEntity<>(body, headers), Map.class);

        assertThat(uploaded.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String url = (String) uploaded.getBody().get("url");
        assertThat(url).startsWith("http://localhost/local-storage/gigs/profiles/");
        Long fileId = ((Number) uploaded.getBody().get("fileId")).longValue();
        assertThat(storageObjectRepository.findById(fileId).orElseThrow().getProvider())
                .isEqualTo(StorageProvider.LOCAL);

        ResponseEntity<byte[]> served =
                rest.getForEntity(url.replace("http://localhost", ""), byte[].class);
        assertThat(served.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(served.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_JPEG);

        HttpHeaders json = new HttpHeaders();
        json.setBearerAuth(headers.getFirst(HttpHeaders.AUTHORIZATION).substring(7));
        json.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> attached =
                rest.exchange(
                        "/api/me/profile-image",
                        org.springframework.http.HttpMethod.PUT,
                        new HttpEntity<>(Map.of("fileId", fileId), json),
                        Map.class);
        assertThat(attached.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
