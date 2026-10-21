package com.studyclub.api.storage;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.storage.StorageProvider;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 로컬 개발용 {@link ObjectStorage} — S3 키 없이 올리기·연결·지우기를 끝까지 돌려 보게. 파일은 로컬 폴더에 쓰고 API 서버가 {@value
 * #PATH} 아래로 그대로 내준다.
 *
 * <p>{@code storage.local.enabled=true} 일 때만 빈이 생기고, 생기면 S3 대신 이쪽으로 올린다. 기본값은 꺼짐 — stage·production
 * 에서 키가 빠졌을 때 조용히 서버 디스크에 쓰지 않고 503 을 내야 원인이 보인다.
 */
@Component
@ConditionalOnProperty(value = "storage.local.enabled", havingValue = "true")
public class LocalObjectStorage implements ObjectStorage, WebMvcConfigurer {

    /** 파일을 내주는 경로. SecurityConfig 가 GET 을 연다. */
    public static final String PATH = "/local-storage";

    private final Path root;
    private final String baseUrl;

    public LocalObjectStorage(StorageProperties storageProperties) {
        StorageProperties.Local local = storageProperties.local();
        this.root = Path.of(local.dir()).toAbsolutePath().normalize();
        String base = local.publicBaseUrl();
        this.baseUrl = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    @Override
    public StorageProvider provider() {
        return StorageProvider.LOCAL;
    }

    @Override
    public boolean isConfigured() {
        return true;
    }

    @Override
    public void put(String key, byte[] bytes, String contentType) {
        try {
            Path file = resolve(key);
            Files.createDirectories(file.getParent());
            Files.write(file, bytes);
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "파일을 저장하지 못했습니다.");
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "파일을 지우지 못했습니다.");
        }
    }

    @Override
    public String publicUrl(String key) {
        return baseUrl + "/" + key;
    }

    @Override
    public Optional<String> keyFromUrl(String url) {
        String prefix = baseUrl + "/";
        if (url == null || !url.startsWith(prefix) || url.length() == prefix.length()) {
            return Optional.empty();
        }
        return Optional.of(url.substring(prefix.length()));
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(PATH + "/**").addResourceLocations(root.toUri().toString());
    }

    /** 키는 서버가 만든 {@code gigs/<폴더>/<UUID>.<확장자>} 라 밖으로 나갈 일이 없지만, 그래도 루트 밖이면 거부한다. */
    private Path resolve(String key) {
        Path file = root.resolve(key).normalize();
        if (!file.startsWith(root)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "잘못된 파일 위치입니다.");
        }
        return file;
    }
}
