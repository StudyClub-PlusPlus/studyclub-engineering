package com.studyclub.api.storage;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Service
public class StudyThumbnailUploadService {
    private static final long MAX_SIZE = 5L * 1024 * 1024;
    private static final Map<String, String> EXTENSIONS =
            Map.of("image/jpeg", "jpg", "image/png", "png", "image/webp", "webp");

    private final S3Presigner presigner;
    private final S3StorageConfig.S3StorageProperties properties;

    public StudyThumbnailUploadService(
            S3Presigner presigner, S3StorageConfig.S3StorageProperties properties) {
        this.presigner = presigner;
        this.properties = properties;
    }

    public StudyThumbnailUploadResponse createUploadUrl(StudyThumbnailUploadRequest request) {
        String contentType = request.contentType().toLowerCase(Locale.ROOT);
        String extension = EXTENSIONS.get(contentType);
        if (extension == null || request.size() > MAX_SIZE) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "JPG, PNG, WebP 이미지만 5MB 이하로 업로드할 수 있습니다.");
        }

        String key = "gigs/thumbnails/" + UUID.randomUUID() + "." + extension;
        PutObjectRequest object =
                PutObjectRequest.builder()
                        .bucket(properties.bucket())
                        .key(key)
                        .contentType(contentType)
                        .build();
        PutObjectPresignRequest presignRequest =
                PutObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofMinutes(10))
                        .putObjectRequest(object)
                        .build();
        String uploadUrl = presigner.presignPutObject(presignRequest).url().toString();
        String thumbnailUrl =
                properties.cdnBaseUrl().toString().replaceAll("/$", "") + "/studyclub/" + key;
        return new StudyThumbnailUploadResponse(uploadUrl, thumbnailUrl);
    }
}
