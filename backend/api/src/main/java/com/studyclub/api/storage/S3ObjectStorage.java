package com.studyclub.api.storage;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.storage.StorageProvider;
import jakarta.annotation.PreDestroy;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/**
 * {@link ObjectStorage} 의 S3 구현. 알림 모듈의 SES 클라이언트와 같은 방식 — 처음 쓸 때 {@link S3Client} 를 만들어 두고 재사용한다.
 *
 * <p>설정이 없으면 클라이언트를 만들지 않는다. 빈 자격증명으로 만들면 첫 호출에서야 이상한 메시지로 터지는데, 그 전에 여기서 503 으로 끊는 편이 원인이 보인다.
 */
@Component
public class S3ObjectStorage implements ObjectStorage {

    private static final Logger log = LoggerFactory.getLogger(S3ObjectStorage.class);

    /** 공개 파일은 CloudFront 가 하루 캐시한다. 지운 사진이 최대 하루 보일 수 있는 이유 — 스펙 「미확정」. */
    private static final String CACHE_CONTROL = "public, max-age=86400";

    private final StorageProperties.S3 properties;
    private volatile S3Client client;

    public S3ObjectStorage(StorageProperties storageProperties) {
        this.properties = storageProperties.s3();
    }

    @Override
    public StorageProvider provider() {
        return StorageProvider.S3;
    }

    @Override
    public boolean isConfigured() {
        return properties != null && properties.isConfigured();
    }

    @Override
    public void put(String key, byte[] bytes, String contentType) {
        try {
            client().putObject(
                            PutObjectRequest.builder()
                                    .bucket(properties.bucket())
                                    .key(key)
                                    .contentType(contentType)
                                    .cacheControl(CACHE_CONTROL)
                                    .build(),
                            RequestBody.fromBytes(bytes));
        } catch (SdkException e) {
            log.warn("S3 올리기 실패 key={}", key, e);
            throw new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "파일을 저장하지 못했습니다.");
        }
    }

    @Override
    public void delete(String key) {
        try {
            client().deleteObject(
                            DeleteObjectRequest.builder()
                                    .bucket(properties.bucket())
                                    .key(key)
                                    .build());
        } catch (SdkException e) {
            log.warn("S3 지우기 실패 key={}", key, e);
            throw new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "파일을 지우지 못했습니다.");
        }
    }

    @Override
    public String publicUrl(String key) {
        return baseUrl() + "/" + key;
    }

    @Override
    public Optional<String> keyFromUrl(String url) {
        if (url == null || !isConfigured()) {
            return Optional.empty();
        }
        String prefix = baseUrl() + "/";
        if (!url.startsWith(prefix) || url.length() == prefix.length()) {
            return Optional.empty();
        }
        return Optional.of(url.substring(prefix.length()));
    }

    /** 끝의 {@code /} 는 떼고 쓴다 — env 에 슬래시를 붙여 넣어도 주소에 {@code //} 가 생기지 않게. */
    private String baseUrl() {
        String base = properties.publicBaseUrl();
        if (base.endsWith("/")) {
            return base.substring(0, base.length() - 1);
        }
        return base;
    }

    private S3Client client() {
        if (!isConfigured()) {
            throw new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "파일 저장소가 설정되지 않았습니다.");
        }
        S3Client current = client;
        if (current == null) {
            synchronized (this) {
                if (client == null) {
                    client = buildClient();
                }
                current = client;
            }
        }
        return current;
    }

    private S3Client buildClient() {
        return S3Client.builder()
                .region(Region.of(properties.region()))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(
                                        properties.accessKeyId(), properties.secretAccessKey())))
                .build();
    }

    @PreDestroy
    void close() {
        S3Client current = client;
        if (current != null) {
            current.close();
        }
    }
}
