package com.studyclub.api.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.api.auth.AccountDeletionService;
import com.studyclub.api.storage.ObjectStorage;
import com.studyclub.api.study.StudyCreateRequest;
import com.studyclub.api.study.StudyService;
import com.studyclub.api.study.StudyUpdateRequest;
import com.studyclub.common.error.BusinessException;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.LeaveReason;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.storage.StorageObjectRepository;
import com.studyclub.domain.storage.StorageObjectStatus;
import com.studyclub.domain.storage.StoragePurpose;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** 스터디 썸네일 — 등록 · 교체(다른 운영자) · 지우기 · 스터디 삭제 · 올린 운영자 탈퇴 (docs/flows/image-upload.md). */
@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:studythumbnail;MODE=MySQL;DB_CLOSE_DELAY=-1"
        })
class StudyThumbnailIntegrationTest {

    @Autowired StudyService studyService;
    @Autowired UploadService uploadService;
    @Autowired StudyRepository studyRepository;
    @Autowired StorageObjectRepository storageObjectRepository;
    @Autowired AccountRepository accountRepository;
    @Autowired AccountDeletionService accountDeletionService;
    @MockitoBean ObjectStorage storage;

    Map<String, byte[]> stored;

    @BeforeEach
    void setUp() {
        stored = UploadTestSupport.stubInMemory(storage);
    }

    private Long admin() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Account account =
                accountRepository.save(
                        new Account(
                                "st-" + suffix + "@example.com",
                                "account_" + suffix,
                                null,
                                SystemRole.ADMIN));
        account.completeOnboarding("a" + suffix, "Asia/Seoul", Instant.now());
        return accountRepository.save(account).getId();
    }

    private Long upload(Long accountId, StoragePurpose purpose) {
        return uploadService.upload(accountId, purpose, UploadTestSupport.jpegWithGps()).fileId();
    }

    private Long createStudy(Long accountId, Long thumbnailFileId) {
        return studyService.create(
                accountId,
                new StudyCreateRequest(
                        null,
                        null,
                        "썸네일 스터디",
                        "소개",
                        null,
                        StudyCategory.ALGORITHM,
                        thumbnailFileId,
                        Instant.now().plus(7, ChronoUnit.DAYS),
                        null,
                        null));
    }

    private String thumbnailOf(Long studyId) {
        return studyRepository.findById(studyId).orElseThrow().getThumbnailUrl();
    }

    private StudyUpdateRequest thumbnail(Long fileId) {
        StudyUpdateRequest request = new StudyUpdateRequest();
        request.setThumbnailFileId(fileId);
        return request;
    }

    @Test
    @DisplayName("등록 - 번호로 연결되고 주소가 들어간다")
    void createsWithThumbnail() {
        Long admin = admin();
        Long fileId = upload(admin, StoragePurpose.STUDY_THUMBNAIL);

        Long studyId = createStudy(admin, fileId);

        var row = storageObjectRepository.findById(fileId).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(StorageObjectStatus.ATTACHED);
        assertThat(thumbnailOf(studyId))
                .isEqualTo(UploadTestSupport.BASE_URL + "/" + row.getObjectKey());
    }

    @Test
    @DisplayName("등록 - 프로필용으로 올린 번호는 썸네일에 못 쓴다")
    void rejectsProfileFile() {
        Long admin = admin();
        Long profileFile = upload(admin, StoragePurpose.PROFILE);

        assertThatThrownBy(() -> createStudy(admin, profileFile))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("교체 - 다른 운영자가 바꿔도 옛 파일이 지워진다")
    void replacesAcrossAdmins() {
        Long a = admin();
        Long b = admin();
        Long first = upload(a, StoragePurpose.STUDY_THUMBNAIL);
        Long studyId = createStudy(a, first);
        String firstKey = storageObjectRepository.findById(first).orElseThrow().getObjectKey();
        Long second = upload(b, StoragePurpose.STUDY_THUMBNAIL);

        studyService.updateFromBackOffice(b, studyId, thumbnail(second));

        assertThat(storageObjectRepository.findById(first)).isEmpty();
        assertThat(stored).doesNotContainKey(firstKey);
        assertThat(thumbnailOf(studyId))
                .endsWith(storageObjectRepository.findById(second).orElseThrow().getObjectKey());
    }

    @Test
    @DisplayName("지우기 - null 을 보내면 썸네일이 비고 파일이 지워진다")
    void removesThumbnail() {
        Long admin = admin();
        Long fileId = upload(admin, StoragePurpose.STUDY_THUMBNAIL);
        Long studyId = createStudy(admin, fileId);

        studyService.updateFromBackOffice(admin, studyId, thumbnail(null));

        assertThat(thumbnailOf(studyId)).isNull();
        assertThat(storageObjectRepository.findById(fileId)).isEmpty();
    }

    @Test
    @DisplayName("스터디 삭제 - 썸네일 파일도 지워진다")
    void deletesWithStudy() {
        Long admin = admin();
        Long fileId = upload(admin, StoragePurpose.STUDY_THUMBNAIL);
        Long studyId = createStudy(admin, fileId);

        studyService.delete(studyId);

        assertThat(storageObjectRepository.findById(fileId)).isEmpty();
    }

    @Test
    @DisplayName("탈퇴 - 올린 운영자가 탈퇴해도 스터디에 붙은 썸네일은 남는다")
    void keepsThumbnailWhenUploaderLeaves() {
        Long admin = admin();
        Long fileId = upload(admin, StoragePurpose.STUDY_THUMBNAIL);
        Long studyId = createStudy(admin, fileId);
        Long pending = upload(admin, StoragePurpose.STUDY_THUMBNAIL);

        accountDeletionService.deleteAccount(admin, LeaveReason.OTHER);

        assertThat(storageObjectRepository.findById(fileId).orElseThrow().getStatus())
                .isEqualTo(StorageObjectStatus.ATTACHED);
        assertThat(thumbnailOf(studyId)).isNotNull();
        assertThat(storageObjectRepository.findById(pending)).isEmpty();
    }
}
