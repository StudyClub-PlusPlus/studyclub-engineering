package com.studyclub.api.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalObjectStorageTest {

    @TempDir Path dir;

    private LocalObjectStorage storage() {
        return new LocalObjectStorage(
                new StorageProperties(
                        null,
                        new StorageProperties.Local(
                                true, dir.toString(), "http://localhost:8080/local-storage/")));
    }

    @Test
    void 올리고_주소로_키를_되찾고_지운다() throws Exception {
        LocalObjectStorage storage = storage();

        storage.put("gigs/profiles/a.jpg", new byte[] {1, 2, 3}, "image/jpeg");

        assertThat(Files.readAllBytes(dir.resolve("gigs/profiles/a.jpg"))).containsExactly(1, 2, 3);
        String url = storage.publicUrl("gigs/profiles/a.jpg");
        assertThat(url).isEqualTo("http://localhost:8080/local-storage/gigs/profiles/a.jpg");
        assertThat(storage.keyFromUrl(url)).contains("gigs/profiles/a.jpg");
        assertThat(storage.keyFromUrl("https://lh3.googleusercontent.com/a/abc")).isEmpty();

        storage.delete("gigs/profiles/a.jpg");
        storage.delete("gigs/profiles/a.jpg"); // 없는 키도 성공

        assertThat(dir.resolve("gigs/profiles/a.jpg")).doesNotExist();
    }

    @Test
    void 루트_밖으로_나가는_키는_거부한다() {
        assertThatThrownBy(() -> storage().put("../escape.jpg", new byte[1], "image/jpeg"))
                .isInstanceOf(BusinessException.class);
    }
}
