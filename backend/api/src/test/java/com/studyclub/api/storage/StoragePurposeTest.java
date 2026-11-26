package com.studyclub.api.storage;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.storage.StorageObject;
import com.studyclub.domain.storage.StorageProvider;
import com.studyclub.domain.storage.StoragePurpose;
import org.junit.jupiter.api.Test;

class StoragePurposeTest {

    @Test
    void 문의_첨부만_비공개_폴더다() {
        assertThat(StoragePurpose.FEEDBACK.isPublic()).isFalse();
        assertThat(StoragePurpose.FEEDBACK.folder()).startsWith("private/");
        assertThat(StoragePurpose.PROFILE.isPublic()).isTrue();
        assertThat(StoragePurpose.PROFILE.folder()).startsWith("gigs/");
        assertThat(StoragePurpose.STUDY_THUMBNAIL.isPublic()).isTrue();
        assertThat(StoragePurpose.STUDY_THUMBNAIL.folder()).startsWith("gigs/");
    }

    @Test
    void 연결되지_않은_파일은_내주지_않는다() {
        StorageObject pending =
                new StorageObject(
                        1L,
                        StoragePurpose.FEEDBACK,
                        StorageProvider.S3,
                        "private/feedbacks/a.jpg",
                        "image/jpeg",
                        3);

        assertThat(pending.isServable()).isFalse();
    }
}
