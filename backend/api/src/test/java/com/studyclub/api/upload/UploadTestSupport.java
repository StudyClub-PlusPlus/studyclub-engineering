package com.studyclub.api.upload;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

import com.studyclub.api.storage.ObjectStorage;
import com.studyclub.domain.storage.StorageProvider;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** 통합 테스트 공용 — 저장소 가짜 스텁과 조립한 jpeg 바이트. */
public final class UploadTestSupport {

    public static final String BASE_URL = "https://cdn.test/studyclub";

    private UploadTestSupport() {}

    /**
     * 저장소 mock 을 메모리 맵으로 동작하게 한다. {@code @MockitoBean} 은 테스트마다 초기화되므로 {@code @BeforeEach} 에서 부른다.
     */
    public static Map<String, byte[]> stubInMemory(ObjectStorage storage) {
        Map<String, byte[]> stored = new ConcurrentHashMap<>();
        when(storage.provider()).thenReturn(StorageProvider.S3);
        when(storage.isConfigured()).thenReturn(true);
        when(storage.publicUrl(anyString()))
                .thenAnswer(inv -> BASE_URL + "/" + inv.getArgument(0, String.class));
        when(storage.keyFromUrl(any()))
                .thenAnswer(
                        inv -> {
                            String url = inv.getArgument(0, String.class);
                            String prefix = BASE_URL + "/";
                            if (url == null || !url.startsWith(prefix)) {
                                return Optional.empty();
                            }
                            return Optional.of(url.substring(prefix.length()));
                        });
        doAnswer(
                        inv -> {
                            stored.put(
                                    inv.getArgument(0, String.class),
                                    inv.getArgument(1, byte[].class));
                            return null;
                        })
                .when(storage)
                .put(anyString(), any(), anyString());
        doAnswer(
                        inv -> {
                            stored.remove(inv.getArgument(0, String.class));
                            return null;
                        })
                .when(storage)
                .delete(anyString());
        return stored;
    }

    /** SOI · APP1(GPS 문자열) · DQT · SOS+데이터 · EOI — 걷어내면 "GPS" 가 사라진다. */
    public static byte[] jpegWithGps() {
        byte[] app1 = segment(0xE1, "Exif\0\0GPS 37.5 127.0".getBytes(StandardCharsets.US_ASCII));
        byte[] dqt = segment(0xDB, new byte[] {0, 1, 2, 3});
        byte[] sos =
                new byte[] {
                    (byte) 0xFF,
                    (byte) 0xDA,
                    0,
                    8,
                    1,
                    1,
                    0,
                    0,
                    63,
                    0,
                    0x12,
                    0x34,
                    (byte) 0xFF,
                    (byte) 0xD9
                };
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(0xFF);
        out.write(0xD8);
        out.write(app1, 0, app1.length);
        out.write(dqt, 0, dqt.length);
        out.write(sos, 0, sos.length);
        return out.toByteArray();
    }

    private static byte[] segment(int marker, byte[] payload) {
        int length = payload.length + 2;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(0xFF);
        out.write(marker);
        out.write((length >> 8) & 0xFF);
        out.write(length & 0xFF);
        out.write(payload, 0, payload.length);
        return out.toByteArray();
    }
}
