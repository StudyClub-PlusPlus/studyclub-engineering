package com.studyclub.api.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

import com.studyclub.api.auth.AccountDeletionService;
import com.studyclub.api.auth.JwtService;
import com.studyclub.api.storage.ObjectStorage;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.LeaveReason;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.storage.StorageObject;
import com.studyclub.domain.storage.StorageObjectRepository;
import com.studyclub.domain.storage.StorageObjectStatus;
import com.studyclub.domain.storage.StorageProvider;
import com.studyclub.domain.storage.StoragePurpose;
import java.sql.Timestamp;
import java.time.Duration;
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
 * PUT · DELETE /api/me/profile-image + 정리 배치 + 탈퇴 시 파일 삭제 (specs/profile-image/spec.md,
 * specs/user-leave/spec.md 5단계). 저장소는 가짜 — 어떤 키가 지워졌는지와 행 상태만 본다.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.datasource.url=jdbc:h2:mem:profileimage;MODE=MySQL;DB_CLOSE_DELAY=-1"
        })
@AutoConfigureTestRestTemplate
class ProfileImageIntegrationTest {

    private static final String GOOGLE_PICTURE = "https://lh3.googleusercontent.com/a/abc";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired StorageObjectRepository storageObjectRepository;
    @Autowired UploadService uploadService;
    @Autowired AccountDeletionService accountDeletionService;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ObjectStorage storage;

    Map<String, byte[]> stored;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        stored = UploadTestSupport.stubInMemory(storage);
    }

    // ---- 도우미 -------------------------------------------------------------------------------

    private Account seedOnboardedAccount(String picture) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Account account =
                accountRepository.save(
                        new Account(
                                "pi-" + suffix + "@example.com",
                                "account_" + suffix,
                                picture,
                                SystemRole.MEMBER));
        account.completeOnboarding("n" + suffix, "Asia/Seoul", Instant.now());
        return accountRepository.save(account);
    }

    private HttpHeaders bearer(Account account) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return headers;
    }

    /** 올리기 API 로 PENDING 행 하나. 돌려주는 건 fileId. */
    private Long upload(Account account, String purpose) {
        HttpHeaders headers = bearer(account);
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
        body.add("purpose", purpose);
        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> response =
                rest.postForEntity(
                        "/api/uploads/images", new HttpEntity<>(body, headers), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return ((Number) response.getBody().get("fileId")).longValue();
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> attach(Account account, Object fileId) {
        HttpHeaders headers = bearer(account);
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> body = fileId == null ? Map.of() : Map.of("fileId", fileId);
        return rest.exchange(
                "/api/me/profile-image",
                HttpMethod.PUT,
                new HttpEntity<>(body, headers),
                Map.class);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> remove(Account account) {
        return rest.exchange(
                "/api/me/profile-image",
                HttpMethod.DELETE,
                new HttpEntity<>(bearer(account)),
                Map.class);
    }

    private StorageObject row(Long fileId) {
        return storageObjectRepository.findById(fileId).orElseThrow();
    }

    private void ageRow(Long fileId, Duration age) {
        jdbc.update(
                "UPDATE STORAGE_OBJECT SET CREATED_AT = ? WHERE ID = ?",
                Timestamp.from(Instant.now().minus(age)),
                fileId);
    }

    // ---- 연결 ---------------------------------------------------------------------------------

    @Test
    @DisplayName("연결 성공 - 200 AccountView.picture 가 새 주소, 행은 ATTACHED, PROFILE_IMG_URL 갱신")
    void attachesUploadedFile() {
        Account account = seedOnboardedAccount(null);
        Long fileId = upload(account, "PROFILE");

        var response = attach(account, fileId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        StorageObject attached = row(fileId);
        String expectedUrl = UploadTestSupport.BASE_URL + "/" + attached.getObjectKey();
        assertThat(response.getBody()).containsEntry("picture", expectedUrl);
        assertThat(attached.getStatus()).isEqualTo(StorageObjectStatus.ATTACHED);
        assertThat(attached.getAttachedAt()).isNotNull();
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getProfileImgUrl())
                .isEqualTo(expectedUrl);
    }

    @Test
    @DisplayName("연결 실패 - 남의 번호 · 썸네일용 번호 · 같은 번호 두 번 · fileId 없음 전부 400 같은 문구")
    void rejectsWrongFile() {
        Account me = seedOnboardedAccount(null);
        Account other = seedOnboardedAccount(null);
        Long othersFile = upload(other, "PROFILE");
        Long thumbnail = upload(me, "STUDY_THUMBNAIL");
        Long mine = upload(me, "PROFILE");
        assertThat(attach(me, mine).getStatusCode()).isEqualTo(HttpStatus.OK);

        for (Object fileId : new Object[] {othersFile, thumbnail, mine, 999_999L, null}) {
            var response = attach(me, fileId);
            assertThat(response.getStatusCode())
                    .as("fileId=" + fileId)
                    .isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody())
                    .containsEntry("errorMessage", "업로드한 사진을 찾을 수 없습니다. 다시 올려 주세요.");
        }
        assertThat(row(othersFile).getStatus()).isEqualTo(StorageObjectStatus.PENDING);
        assertThat(row(thumbnail).getStatus()).isEqualTo(StorageObjectStatus.PENDING);
    }

    // ---- 교체 ---------------------------------------------------------------------------------

    @Test
    @DisplayName("교체 - 옛 행은 커밋 뒤 파일·행 삭제, 새 행은 ATTACHED")
    void replacesOldFile() {
        Account account = seedOnboardedAccount(null);
        Long first = upload(account, "PROFILE");
        attach(account, first);
        String firstKey = row(first).getObjectKey();
        Long second = upload(account, "PROFILE");

        var response = attach(account, second);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(storageObjectRepository.findById(first)).isEmpty();
        assertThat(stored).doesNotContainKey(firstKey);
        assertThat(row(second).getStatus()).isEqualTo(StorageObjectStatus.ATTACHED);
        verify(storage).delete(firstKey);
    }

    @Test
    @DisplayName("지우기 - 내 주소 칸에 남의 파일 주소가 있어도 남의 파일은 지우지 않는다")
    void doesNotDeleteOthersFile() {
        Account owner = seedOnboardedAccount(null);
        Long ownersFile = upload(owner, "PROFILE");
        attach(owner, ownersFile);
        String ownersUrl =
                accountRepository.findById(owner.getId()).orElseThrow().getProfileImgUrl();
        Account other = seedOnboardedAccount(ownersUrl);

        assertThat(remove(other).getStatusCode()).isEqualTo(HttpStatus.OK);

        assertThat(row(ownersFile).getStatus()).isEqualTo(StorageObjectStatus.ATTACHED);
        verify(storage, org.mockito.Mockito.never()).delete(anyString());
    }

    @Test
    @DisplayName("교체 - 옛 주소가 구글 사진이면 아무것도 지우지 않는다")
    void doesNotDeleteGooglePicture() {
        Account account = seedOnboardedAccount(GOOGLE_PICTURE);
        Long fileId = upload(account, "PROFILE");

        assertThat(attach(account, fileId).getStatusCode()).isEqualTo(HttpStatus.OK);

        verify(storage, org.mockito.Mockito.never()).delete(anyString());
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getProfileImgUrl())
                .isNotEqualTo(GOOGLE_PICTURE);
    }

    @Test
    @DisplayName("교체 - 옛 파일 삭제가 실패해도 응답은 200, 행은 DELETING 으로 남고 배치가 다시 지운다")
    void keepsDeletingRowWhenStorageFails() {
        Account account = seedOnboardedAccount(null);
        Long first = upload(account, "PROFILE");
        attach(account, first);
        String firstKey = row(first).getObjectKey();
        doThrow(new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR))
                .when(storage)
                .delete(firstKey);
        Long second = upload(account, "PROFILE");

        assertThat(attach(account, second).getStatusCode()).isEqualTo(HttpStatus.OK);

        assertThat(row(first).getStatus()).isEqualTo(StorageObjectStatus.DELETING);
        assertThat(stored).containsKey(firstKey);

        // 저장소가 살아나면 배치가 마저 지운다
        stored = UploadTestSupport.stubInMemory(storage);
        uploadService.cleanUp(Instant.now());
        assertThat(storageObjectRepository.findById(first)).isEmpty();
    }

    // ---- 지우기 -------------------------------------------------------------------------------

    @Test
    @DisplayName("지우기 - picture null, 행·파일 삭제. 사진이 없어도 200")
    void removesProfileImage() {
        Account account = seedOnboardedAccount(null);
        Long fileId = upload(account, "PROFILE");
        attach(account, fileId);
        String key = row(fileId).getObjectKey();

        var response = remove(account);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("picture")).isNull();
        assertThat(accountRepository.findById(account.getId()).orElseThrow().getProfileImgUrl())
                .isNull();
        assertThat(storageObjectRepository.findById(fileId)).isEmpty();
        assertThat(stored).doesNotContainKey(key);

        assertThat(remove(account).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("지우기 - 구글 사진이면 DB 값만 null, 저장소 호출 없음")
    void removesGooglePictureWithoutStorageCall() {
        Account account = seedOnboardedAccount(GOOGLE_PICTURE);

        var response = remove(account);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("picture")).isNull();
        verify(storage, org.mockito.Mockito.never()).delete(anyString());
    }

    // ---- 정리 배치 ----------------------------------------------------------------------------

    @Test
    @DisplayName("배치 - 하루 지난 PENDING 과 남은 DELETING 은 지우고, ATTACHED 와 새 PENDING 은 건드리지 않는다")
    void cleansUpExpiredAndDeleting() {
        Account account = seedOnboardedAccount(null);
        Long expired = upload(account, "PROFILE");
        ageRow(expired, Duration.ofHours(25));
        Long fresh = upload(account, "PROFILE");
        Long attached = upload(account, "PROFILE");
        attach(account, attached);
        String expiredKey = row(expired).getObjectKey();

        uploadService.cleanUp(Instant.now());

        assertThat(storageObjectRepository.findById(expired)).isEmpty();
        assertThat(stored).doesNotContainKey(expiredKey);
        assertThat(row(fresh).getStatus()).isEqualTo(StorageObjectStatus.PENDING);
        assertThat(row(attached).getStatus()).isEqualTo(StorageObjectStatus.ATTACHED);
    }

    @Test
    @DisplayName("배치 - 찜한 행(DELETING)에 연결하면 400")
    void claimedRowCannotBeAttached() {
        Account account = seedOnboardedAccount(null);
        Long fileId = upload(account, "PROFILE");
        ageRow(fileId, Duration.ofHours(25));
        doThrow(new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR))
                .when(storage)
                .delete(anyString());
        uploadService.cleanUp(Instant.now());
        assertThat(row(fileId).getStatus()).isEqualTo(StorageObjectStatus.DELETING);

        assertThat(attach(account, fileId).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("배치 - 저장소 설정이 없으면 아무것도 안 한다")
    void cleanUpDoesNothingWithoutStorage() {
        Account account = seedOnboardedAccount(null);
        Long expired = upload(account, "PROFILE");
        ageRow(expired, Duration.ofHours(25));
        org.mockito.Mockito.when(storage.isConfigured()).thenReturn(false);

        uploadService.cleanUp(Instant.now());

        assertThat(row(expired).getStatus()).isEqualTo(StorageObjectStatus.PENDING);
    }

    @Test
    @DisplayName("배치 - 205개 파일을 페이지 누락 없이 지우고 실패한 파일은 다음 실행에서 재시도한다")
    void pagedStorageCleanupRetriesFailure() {
        java.util.List<Long> ids = new java.util.ArrayList<>();
        String failedKey = "test-retention-" + UUID.randomUUID();
        for (int i = 0; i < 205; i++) {
            String key = i == 0 ? failedKey : "test-retention-" + UUID.randomUUID();
            StorageObject object =
                    storageObjectRepository.save(
                            new StorageObject(
                                    9999L,
                                    StoragePurpose.PROFILE,
                                    StorageProvider.S3,
                                    key,
                                    "image/jpeg",
                                    1));
            ids.add(object.getId());
            ageRow(object.getId(), Duration.ofHours(25));
            stored.put(key, new byte[] {1});
        }
        doThrow(new IllegalStateException("test")).when(storage).delete(failedKey);
        uploadService.cleanUp(Instant.now());
        assertThat(storageObjectRepository.findAllById(ids))
                .hasSize(1)
                .allSatisfy(
                        row -> assertThat(row.getStatus()).isEqualTo(StorageObjectStatus.DELETING));
        org.mockito.Mockito.doAnswer(
                        inv -> {
                            stored.remove(failedKey);
                            return null;
                        })
                .when(storage)
                .delete(failedKey);
        uploadService.cleanUp(Instant.now());
        assertThat(storageObjectRepository.findAllById(ids)).isEmpty();
        assertThat(stored).doesNotContainKey(failedKey);
    }

    // ---- 탈퇴 ---------------------------------------------------------------------------------

    @Test
    @DisplayName("탈퇴 - 연결된 사진과 연결 안 된 파일 전부 커밋 뒤 파일·행 삭제")
    void deletesFilesOnAccountDeletion() {
        Account account = seedOnboardedAccount(null);
        Long attached = upload(account, "PROFILE");
        attach(account, attached);
        Long pending = upload(account, "PROFILE");
        String attachedKey = row(attached).getObjectKey();
        String pendingKey = row(pending).getObjectKey();

        accountDeletionService.deleteAccount(account.getId(), LeaveReason.OTHER);

        assertThat(accountRepository.findById(account.getId())).isEmpty();
        assertThat(storageObjectRepository.findById(attached)).isEmpty();
        assertThat(storageObjectRepository.findById(pending)).isEmpty();
        assertThat(stored).doesNotContainKeys(attachedKey, pendingKey);
    }
}
