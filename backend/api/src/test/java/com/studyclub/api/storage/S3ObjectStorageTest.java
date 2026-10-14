package com.studyclub.api.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import org.junit.jupiter.api.Test;

class S3ObjectStorageTest {

    private static S3ObjectStorage storage(String publicBaseUrl) {
        return new S3ObjectStorage(
                new StorageProperties(
                        new StorageProperties.S3(
                                "ap-northeast-2", "bucket", "key", "secret", publicBaseUrl)));
    }

    @Test
    void 설정이_비어_있으면_올리기는_503() {
        S3ObjectStorage storage =
                new S3ObjectStorage(
                        new StorageProperties(new StorageProperties.S3("", "", "", "", "")));

        assertThat(storage.isConfigured()).isFalse();
        assertThatThrownBy(() -> storage.put("gigs/profiles/a.webp", new byte[1], "image/webp"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
    }

    @Test
    void 키와_주소를_서로_바꾼다() {
        S3ObjectStorage storage = storage("https://cdn.example.com/studyclub");

        String url = storage.publicUrl("gigs/profiles/a.webp");

        assertThat(url).isEqualTo("https://cdn.example.com/studyclub/gigs/profiles/a.webp");
        assertThat(storage.keyFromUrl(url)).contains("gigs/profiles/a.webp");
    }

    @Test
    void 접두어_끝_슬래시는_떼고_쓴다() {
        S3ObjectStorage storage = storage("https://cdn.example.com/studyclub/");

        assertThat(storage.publicUrl("gigs/profiles/a.webp"))
                .isEqualTo("https://cdn.example.com/studyclub/gigs/profiles/a.webp");
    }

    @Test
    void 우리_주소가_아니면_키가_없다() {
        S3ObjectStorage storage = storage("https://cdn.example.com/studyclub");

        assertThat(storage.keyFromUrl("https://lh3.googleusercontent.com/a/abc")).isEmpty();
        assertThat(storage.keyFromUrl("https://cdn.example.com/studyclub/")).isEmpty();
        assertThat(storage.keyFromUrl(null)).isEmpty();
    }
}
