package com.studyclub.api.feedback;

import com.studyclub.api.upload.UploadService;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.feedback.Feedback;
import com.studyclub.domain.feedback.FeedbackImage;
import com.studyclub.domain.feedback.FeedbackImageRepository;
import com.studyclub.domain.feedback.FeedbackRepository;
import com.studyclub.domain.storage.StorageObject;
import com.studyclub.domain.storage.StorageObjectRepository;
import com.studyclub.domain.storage.StoragePurpose;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 문의 첨부 이미지를 권한을 확인한 뒤 내준다 (specs/feedback/spec.md). 파일은 비공개 폴더에 있어 공개 주소가 없다.
 *
 * <p>호출 경로가 둘이다. 작성자는 본인 문의만({@link #findMine}), 캡틴은 {@code @RequireAdmin} 을 통과한 뒤({@link
 * #findForAdmin}). 어느 쪽이든 문의 · 이미지 · 파일 상태 중 하나라도 어긋나면 사유를 가르지 않고 404 다. 읽기는 트랜잭션 밖이다 — 저장소를 기다리는
 * 동안 DB 연결을 잡지 않는다.
 */
@Service
@RequiredArgsConstructor
public class FeedbackImageService {

    private final FeedbackRepository feedbackRepository;
    private final FeedbackImageRepository feedbackImageRepository;
    private final StorageObjectRepository storageObjectRepository;
    private final UploadService uploadService;

    @Transactional(readOnly = true)
    public StorageObject findMine(Long accountId, Long feedbackId, Long imageId) {
        Feedback feedback =
                feedbackRepository
                        .findByIdAndAccountId(feedbackId, accountId)
                        .orElseThrow(FeedbackImageService::notFound);
        return servable(feedback, imageId);
    }

    @Transactional(readOnly = true)
    public StorageObject findForAdmin(Long feedbackId, Long imageId) {
        Feedback feedback =
                feedbackRepository.findById(feedbackId).orElseThrow(FeedbackImageService::notFound);
        return servable(feedback, imageId);
    }

    /** 트랜잭션 밖에서 부른다. 응답 본문이 스트림을 읽고 닫는다. */
    public ResponseEntity<InputStreamResource> serve(StorageObject object) {
        InputStreamResource body = new InputStreamResource(uploadService.open(object));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(object.getContentType()))
                .contentLength(object.getSize())
                .cacheControl(CacheControl.noStore().cachePrivate())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .header("Cross-Origin-Resource-Policy", "same-site")
                .body(body);
    }

    private StorageObject servable(Feedback feedback, Long imageId) {
        if (feedback.isRetentionExpired(Instant.now())) {
            throw notFound();
        }
        FeedbackImage image =
                feedbackImageRepository
                        .findByIdAndFeedbackId(imageId, feedback.getId())
                        .orElseThrow(FeedbackImageService::notFound);
        StorageObject object =
                storageObjectRepository
                        .findById(image.getStorageObjectId())
                        .orElseThrow(FeedbackImageService::notFound);
        if (!object.isServable() || object.getPurpose() != StoragePurpose.FEEDBACK) {
            throw notFound();
        }
        return object;
    }

    private static BusinessException notFound() {
        return new BusinessException(ErrorCode.NOT_FOUND, "찾을 수 없는 이미지입니다.");
    }
}
