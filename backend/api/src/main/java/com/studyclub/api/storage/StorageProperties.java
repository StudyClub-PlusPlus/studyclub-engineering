package com.studyclub.api.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 저장소 설정. 값은 전부 env 로 주입한다 (docs/s3-storage.md). 비어 있어도 부팅은 된다 — 로컬처럼 키가 없는 환경에서 올리기만 503 이다.
 *
 * @param s3 S3 구현의 설정. 공개 주소 접두어는 CloudFront 주소에 {@code /studyclub} 까지 — 그 뒤에 {@code /gigs/...} 키가
 *     붙는다
 */
@ConfigurationProperties(prefix = "storage")
public record StorageProperties(S3 s3, Local local) {

    /** 로컬 개발용 저장소 ({@link LocalObjectStorage}). {@code enabled} 가 true 일 때만 쓴다. */
    public record Local(boolean enabled, String dir, String publicBaseUrl) {}

    public record S3(
            String region,
            String bucket,
            String accessKeyId,
            String secretAccessKey,
            String publicBaseUrl) {

        public boolean isConfigured() {
            return notBlank(region)
                    && notBlank(bucket)
                    && notBlank(accessKeyId)
                    && notBlank(secretAccessKey)
                    && notBlank(publicBaseUrl);
        }

        private static boolean notBlank(String value) {
            return value != null && !value.isBlank();
        }
    }
}
