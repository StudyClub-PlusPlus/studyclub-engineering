package com.studyclub.api.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;

import com.studyclub.api.auth.AccountDeletionService;
import com.studyclub.api.storage.ObjectStorage;
import com.studyclub.api.upload.UploadService;
import com.studyclub.api.upload.UploadTestSupport;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.feedback.Feedback;
import com.studyclub.domain.feedback.FeedbackImage;
import com.studyclub.domain.feedback.FeedbackImageRepository;
import com.studyclub.domain.feedback.FeedbackRepository;
import com.studyclub.domain.feedback.FeedbackStatus;
import com.studyclub.domain.feedback.FeedbackType;
import com.studyclub.domain.storage.StorageObject;
import com.studyclub.domain.storage.StorageObjectRepository;
import com.studyclub.domain.storage.StorageObjectStatus;
import com.studyclub.domain.storage.StorageProvider;
import com.studyclub.domain.storage.StoragePurpose;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
        properties =
                "spring.datasource.url=jdbc:h2:mem:feedback-retention;MODE=MySQL;DB_CLOSE_DELAY=-1")
class FeedbackRetentionIntegrationTest {

    private static final Instant NOW = Instant.parse("2026-10-31T12:00:00Z");
    private static final String EXPIRED = "2025-10-31T12:00:00Z";
    private static final String OLD = "2024-10-31T12:00:00Z";
    private static final String RECENT = "2026-10-30T12:00:00Z";

    @Autowired FeedbackRetentionService service;
    @Autowired UploadService uploadService;
    @Autowired AccountDeletionService accountDeletionService;
    @Autowired AccountRepository accounts;
    @MockitoSpyBean FeedbackRepository feedbacks;
    @MockitoSpyBean FeedbackImageRepository images;
    @Autowired StorageObjectRepository objects;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ObjectStorage storage;

    private Map<String, byte[]> stored;
    private Account account;
    private TransactionTemplate transaction;

    @BeforeEach
    void setUp() {
        images.deleteAllInBatch();
        feedbacks.deleteAllInBatch();
        objects.deleteAllInBatch();
        accounts.deleteAllInBatch();
        stored = UploadTestSupport.stubInMemory(storage);
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        account =
                accounts.save(
                        new Account(
                                "retention-" + suffix + "@example.com",
                                "retention_" + suffix,
                                null,
                                SystemRole.MEMBER));
        transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Test
    @DisplayName("만료된 문의와 모든 첨부는 삭제하고 같은 회원의 다른 문의·프로필·썸네일은 보존한다")
    void deletesOnlyExpiredFeedbackAndItsFilesAfterCommit() {
        Feedback expired = feedback(EXPIRED, null);
        Feedback seen = feedback(EXPIRED, null);
        seen.changeStatus(FeedbackStatus.SEEN);
        feedbacks.save(seen);
        Feedback answered = feedback(OLD, EXPIRED);
        Feedback recent = feedback(RECENT, null);
        Feedback recentlyAnswered = feedback(OLD, RECENT);
        StorageObject first = image(expired, 0);
        StorageObject second = image(expired, 1);
        StorageObject replyFile = image(answered, 0);
        StorageObject kept = image(recent, 0);
        StorageObject profile = file(StoragePurpose.PROFILE);
        StorageObject thumbnail = file(StoragePurpose.STUDY_THUMBNAIL);
        AtomicBoolean observedCommittedDeletion = new AtomicBoolean();
        doAnswer(
                        inv -> {
                            // 별도 DB 연결에서도 삭제가 보여야 파일을 지울 수 있다.
                            transaction.executeWithoutResult(
                                    status -> {
                                        assertThat(
                                                        jdbc.queryForObject(
                                                                "select count(*) from FEEDBACK where ID = ?",
                                                                Long.class,
                                                                expired.getId()))
                                                .isZero();
                                        assertThat(
                                                        jdbc.queryForObject(
                                                                "select count(*) from FEEDBACK_IMAGE where FEEDBACK_ID = ?",
                                                                Long.class,
                                                                expired.getId()))
                                                .isZero();
                                        assertThat(
                                                        jdbc.queryForObject(
                                                                "select STATUS from STORAGE_OBJECT where ID = ?",
                                                                String.class,
                                                                first.getId()))
                                                .isEqualTo("DELETING");
                                    });
                            observedCommittedDeletion.set(true);
                            stored.remove(first.getObjectKey());
                            return null;
                        })
                .when(storage)
                .delete(first.getObjectKey());

        assertThat(service.cleanUp(NOW)).isEqualTo(3);

        assertThat(observedCommittedDeletion).isTrue();
        assertThat(feedbacks.findAll())
                .extracting(Feedback::getId)
                .containsExactlyInAnyOrder(recent.getId(), recentlyAnswered.getId());
        assertThat(images.findAll())
                .extracting(FeedbackImage::getStorageObjectId)
                .containsExactly(kept.getId());
        assertThat(objects.findAll())
                .extracting(StorageObject::getId)
                .containsExactlyInAnyOrder(kept.getId(), profile.getId(), thumbnail.getId());
        assertThat(stored)
                .doesNotContainKeys(
                        first.getObjectKey(), second.getObjectKey(), replyFile.getObjectKey());
        assertThat(stored)
                .containsKeys(
                        kept.getObjectKey(), profile.getObjectKey(), thumbnail.getObjectKey());
        assertThat(service.cleanUp(NOW)).isZero();
    }

    @Test
    @DisplayName("탈퇴로 첨부가 먼저 없어져도 문의는 기존 기한에 삭제된다")
    void withdrawalDoesNotResetRetention() {
        Feedback expired = feedback(EXPIRED, null);
        Feedback recent = feedback(RECENT, null);
        StorageObject attachment = image(expired, 0);
        accountDeletionService.deleteAccount(account.getId(), null);
        assertThat(feedbacks.existsById(expired.getId())).isTrue();
        assertThat(stored).doesNotContainKey(attachment.getObjectKey());

        assertThat(service.cleanUp(NOW)).isEqualTo(1);

        assertThat(feedbacks.findAll()).extracting(Feedback::getId).containsExactly(recent.getId());
    }

    @Test
    @DisplayName("저장소 삭제 실패는 문의 삭제를 막지 않고 기존 업로드 배치가 파일을 재시도한다")
    void storageFailureIsRetried() {
        Feedback expired = feedback(EXPIRED, null);
        StorageObject attachment = image(expired, 0);
        AtomicBoolean failOnce = new AtomicBoolean(true);
        doAnswer(
                        inv -> {
                            if (failOnce.getAndSet(false)) {
                                throw new IllegalStateException("test storage unavailable");
                            }
                            stored.remove(attachment.getObjectKey());
                            return null;
                        })
                .when(storage)
                .delete(attachment.getObjectKey());

        assertThat(service.cleanUp(NOW)).isEqualTo(1);

        assertThat(feedbacks.findAll()).isEmpty();
        assertThat(images.findAll()).isEmpty();
        assertThat(objects.findById(attachment.getId()).orElseThrow().getStatus())
                .isEqualTo(StorageObjectStatus.DELETING);
        assertThat(stored).containsKey(attachment.getObjectKey());

        uploadService.cleanUp(NOW.plusSeconds(3600));

        assertThat(objects.findAll()).isEmpty();
        assertThat(stored).isEmpty();
    }

    @Test
    @DisplayName("DB 실패는 문의·첨부·삭제 예약을 함께 롤백하고 다른 문의는 계속 처리한다")
    void databaseFailureRollsBackAndRetriesNextRun() {
        Feedback failed = feedback(EXPIRED, null);
        StorageObject attachment = image(failed, 0);
        Feedback next = feedback(EXPIRED, null);
        doThrow(new IllegalStateException("test database failure"))
                .when(images)
                .deleteAllByFeedbackId(failed.getId());

        assertThat(service.cleanUp(NOW)).isEqualTo(1);

        assertThat(feedbacks.existsById(next.getId())).isFalse();
        assertThat(feedbacks.existsById(failed.getId())).isTrue();
        assertThat(images.findAllByFeedbackIdOrderByDisplayOrderAsc(failed.getId())).hasSize(1);
        assertThat(objects.findById(attachment.getId()).orElseThrow().getStatus())
                .isEqualTo(StorageObjectStatus.ATTACHED);
        assertThat(stored).containsKey(attachment.getObjectKey());
        verify(storage, never()).delete(anyString());

        reset(images);
        assertThat(service.cleanUp(NOW)).isEqualTo(1);
        assertThat(feedbacks.findAll()).isEmpty();
        assertThat(objects.findAll()).isEmpty();
        assertThat(stored).isEmpty();
    }

    @Test
    @DisplayName("후보 선정 뒤 첫 답변이 저장되면 새 기준으로 다시 확인하여 삭제하지 않는다")
    void firstReplyBetweenSelectionAndLockIsRespected() {
        Feedback expired = feedback(EXPIRED, null);
        AtomicBoolean replyOnce = new AtomicBoolean(true);
        doAnswer(
                        inv -> {
                            if (replyOnce.getAndSet(false)) {
                                transaction.executeWithoutResult(
                                        status -> {
                                            accounts.findByIdForUpdate(account.getId());
                                            Feedback latest =
                                                    feedbacks
                                                            .findByIdForUpdate(expired.getId())
                                                            .orElseThrow();
                                            latest.reply("첫 답변을 등록했습니다.", account.getId(), NOW);
                                        });
                            }
                            return Optional.of(account.getId());
                        })
                .when(feedbacks)
                .findAccountIdById(anyLong());

        assertThat(service.cleanUp(NOW)).isZero();

        Feedback kept = feedbacks.findById(expired.getId()).orElseThrow();
        assertThat(kept.getRepliedAt()).isEqualTo(NOW);
        assertThat(kept.getStatus()).isEqualTo(FeedbackStatus.DONE);
    }

    @Test
    @DisplayName("윤일의 만료는 누락하지 않고 윤년 때문에 365일이 된 문의는 조기 삭제하지 않는다")
    void candidateSearchHandlesBothLeapYearBoundaries() {
        Feedback leapDay = feedback("2024-02-29T12:00:00Z", null);
        Feedback repliedOnLeapDay = feedback("2024-01-01T00:00:00Z", "2024-02-29T12:00:00Z");
        assertThat(service.cleanUp(Instant.parse("2025-02-28T11:59:59.999999Z"))).isZero();
        assertThat(service.cleanUp(Instant.parse("2025-02-28T12:00:00Z"))).isEqualTo(2);
        assertThat(feedbacks.existsById(leapDay.getId())).isFalse();
        assertThat(feedbacks.existsById(repliedOnLeapDay.getId())).isFalse();

        Feedback afterLeapDay = feedback("2023-03-01T12:00:00Z", null);
        assertThat(service.cleanUp(Instant.parse("2024-02-29T12:00:00Z"))).isZero();
        assertThat(feedbacks.existsById(afterLeapDay.getId())).isTrue();
        assertThat(service.cleanUp(Instant.parse("2024-03-01T12:00:00Z"))).isEqualTo(1);
    }

    @Test
    @DisplayName("한 묶음보다 많은 문의도 삭제 중 건너뛰지 않고 전부 처리한다")
    void deletesAcrossBatchBoundaries() {
        for (int i = 0; i < 105; i++) {
            feedback(EXPIRED, null);
        }

        assertThat(service.cleanUp(NOW)).isEqualTo(105);
        assertThat(feedbacks.findAll()).isEmpty();
        assertThat(service.cleanUp(NOW)).isZero();
    }

    @Test
    @DisplayName("서버 두 대가 같은 만료 문의를 고르더라도 한 번만 삭제한다")
    void concurrentRunsSerializeDeletion() throws Exception {
        Feedback expired = feedback(EXPIRED, null);
        StorageObject attachment = image(expired, 0);
        CyclicBarrier selected = new CyclicBarrier(2);
        doAnswer(
                        inv -> {
                            selected.await(10, TimeUnit.SECONDS);
                            return Optional.of(account.getId());
                        })
                .when(feedbacks)
                .findAccountIdById(expired.getId());

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> service.cleanUp(NOW));
            var second = executor.submit(() -> service.cleanUp(NOW));
            assertThat(first.get(15, TimeUnit.SECONDS) + second.get(15, TimeUnit.SECONDS))
                    .isEqualTo(1);
        }

        assertThat(feedbacks.findAll()).isEmpty();
        assertThat(images.findAll()).isEmpty();
        assertThat(objects.findAll()).isEmpty();
        verify(storage).delete(attachment.getObjectKey());
    }

    private Feedback feedback(String createdAt, String repliedAt) {
        Feedback feedback =
                new Feedback(
                        account.getId(),
                        FeedbackType.QUESTION,
                        "보유 기간 테스트",
                        "문의 내용 테스트입니다.",
                        "Chrome · macOS",
                        1280,
                        720);
        feedback.changeAdminMemo("테스트 운영 메모");
        if (repliedAt != null) {
            feedback.reply("문의에 대한 답변입니다.", account.getId(), Instant.parse(repliedAt));
        }
        feedback = feedbacks.saveAndFlush(feedback);
        jdbc.update(
                "update FEEDBACK set CREATED_AT = ? where ID = ?",
                Timestamp.from(Instant.parse(createdAt)),
                feedback.getId());
        return feedback;
    }

    private StorageObject image(Feedback feedback, int order) {
        StorageObject file = file(StoragePurpose.FEEDBACK);
        images.save(
                new FeedbackImage(
                        feedback.getId(),
                        file.getId(),
                        storage.publicUrl(file.getObjectKey()),
                        order));
        return file;
    }

    private StorageObject file(StoragePurpose purpose) {
        String key = purpose.folder() + "/" + UUID.randomUUID() + ".jpg";
        StorageObject file =
                objects.saveAndFlush(
                        new StorageObject(
                                account.getId(),
                                purpose,
                                StorageProvider.S3,
                                key,
                                "image/jpeg",
                                3));
        transaction.executeWithoutResult(
                status -> objects.attach(file.getId(), account.getId(), purpose, NOW));
        stored.put(key, new byte[] {1, 2, 3});
        return file;
    }
}
