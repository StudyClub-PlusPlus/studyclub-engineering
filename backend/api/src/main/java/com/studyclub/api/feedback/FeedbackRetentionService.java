package com.studyclub.api.feedback;

import com.studyclub.api.cleanup.CleanupResult;
import com.studyclub.api.upload.UploadService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.feedback.Feedback;
import com.studyclub.domain.feedback.FeedbackImage;
import com.studyclub.domain.feedback.FeedbackImageRepository;
import com.studyclub.domain.feedback.FeedbackRepository;
import com.studyclub.domain.storage.StorageObject;
import com.studyclub.domain.storage.StoragePurpose;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** 보유 기간이 끝난 문의와 첨부 파일을 건별로 파기한다. specs/feedback/spec.md */
@Service
public class FeedbackRetentionService {

    private static final Logger log = LoggerFactory.getLogger(FeedbackRetentionService.class);
    private static final int BATCH_SIZE = 100;

    private final FeedbackRepository feedbackRepository;
    private final FeedbackImageRepository imageRepository;
    private final AccountRepository accountRepository;
    private final UploadService uploadService;
    private final TransactionTemplate transaction;

    public FeedbackRetentionService(
            FeedbackRepository feedbackRepository,
            FeedbackImageRepository imageRepository,
            AccountRepository accountRepository,
            UploadService uploadService,
            PlatformTransactionManager transactionManager) {
        this.feedbackRepository = feedbackRepository;
        this.imageRepository = imageRepository;
        this.accountRepository = accountRepository;
        this.uploadService = uploadService;
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public int cleanUp(Instant now) {
        return cleanUpWithResult(now).deleted();
    }

    public CleanupResult cleanUpWithResult(Instant now) {
        // 1년은 최소 365일. 후보를 넓게 잡고, 잠금 뒤 윤년을 포함한 실제 만료일을 판정한다.
        Instant before = now.minus(365, ChronoUnit.DAYS);
        long afterId = 0;
        int deleted = 0;
        int failed = 0;
        while (true) {
            List<Long> ids =
                    feedbackRepository.findRetentionCandidateIds(
                            afterId, before, PageRequest.of(0, BATCH_SIZE));
            if (ids.isEmpty()) {
                break;
            }
            for (Long id : ids) {
                try {
                    if (Boolean.TRUE.equals(
                            transaction.execute(status -> deleteIfExpired(id, now)))) {
                        deleted++;
                    }
                } catch (RuntimeException e) {
                    failed++;
                    // SQL 예외 메시지에 문의 내용이 섞일 수 있어 ID 와 예외 종류만 남긴다.
                    log.warn(
                            "문의 만료 삭제 실패 — 다음 실행에 재시도 id={} error={}",
                            id,
                            e.getClass().getSimpleName());
                }
            }
            // 삭제 때문에 오프셋이 당겨져도 건너뛰지 않는다. 실패한 ID 는 다음 실행에 재시도한다.
            afterId = ids.getLast();
            if (ids.size() < BATCH_SIZE) {
                break;
            }
        }
        if (deleted > 0 || failed > 0) {
            log.info("문의 보유 기간 정리 — 삭제 {}건, 실패 {}건", deleted, failed);
        }
        return CleanupResult.completed(deleted, failed);
    }

    private boolean deleteIfExpired(Long id, Instant now) {
        // 회신·탈퇴와 같은 계정 → 문의 순서. 계정이 사라져도 문의 삭제는 진행한다.
        // 문의 엔티티는 잠금 조회에서 처음 읽어 동시 첫 회신 이전의 상태를 캐시하지 않는다.
        feedbackRepository.findAccountIdById(id).ifPresent(accountRepository::findByIdForUpdate);
        Feedback feedback = feedbackRepository.findByIdForUpdate(id).orElse(null);
        if (feedback == null || !feedback.isRetentionExpired(now)) {
            return false;
        }

        List<StorageObject> files = new ArrayList<>();
        for (FeedbackImage image : imageRepository.findAllByFeedbackIdOrderByDisplayOrderAsc(id)) {
            uploadService
                    .markDeletingByIdForPurpose(
                            image.getStorageObjectId(), StoragePurpose.FEEDBACK, now)
                    .ifPresent(files::add);
        }
        // 문의 삭제와 파일 삭제 예약은 원자적이어야 파일을 잃거나 추적할 수 없는 고아가 생기지 않는다.
        imageRepository.deleteAllByFeedbackId(id);
        feedbackRepository.delete(feedback);
        uploadService.deleteAfterCommit(files);
        return true;
    }
}
