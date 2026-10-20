package com.studyclub.api.storage;

import com.studyclub.domain.storage.StorageProvider;
import java.util.Optional;

/**
 * 오브젝트 스토리지 하나. 구현은 저장소(S3 등)마다 하나씩이고, {@link #provider()} 로 자기가 어느 저장소인지 말한다.
 *
 * <p>올리기는 지금 쓰는 구현에, 지우기는 행에 적힌 {@link StorageProvider} 와 맞는 구현에 간다 — 다른 저장소로 옮기는 동안 두 구현이 같이 있어도 각
 * 파일을 제 저장소에서 지운다.
 *
 * <p>호출은 트랜잭션 밖에서 한다. 외부 네트워크를 기다리는 동안 DB 잠금을 잡지 않기 위해서다.
 */
public interface ObjectStorage {

    StorageProvider provider();

    /** 설정(키·버킷·주소)이 다 있어야 true. 없으면 올리기는 503, 정리 배치는 아무것도 안 한다. */
    boolean isConfigured();

    /**
     * 파일을 올린다. 같은 키에 두 번 올리지 않는다 — 올릴 때마다 새 UUID 키라 CDN 캐시가 옛 파일을 주는 일이 없다.
     *
     * @throws com.studyclub.common.error.BusinessException 설정이 없거나 저장소가 거부하면 {@code
     *     EXTERNAL_SERVICE_ERROR}
     */
    void put(String key, byte[] bytes, String contentType);

    /**
     * 파일을 지운다. 없는 키를 지워도 성공이다 — 배치와 커밋 뒤 삭제가 같은 행을 집어도 괜찮은 이유.
     *
     * @throws com.studyclub.common.error.BusinessException 설정이 없거나 저장소가 거부하면 {@code
     *     EXTERNAL_SERVICE_ERROR}
     */
    void delete(String key);

    /** 키 → 누구나 볼 수 있는 주소. {@code <공개 주소 접두어>/<키>}. */
    String publicUrl(String key);

    /** 주소 → 키. 우리 공개 주소 접두어로 시작하지 않으면(구글 사진 등) 비어 있다. */
    Optional<String> keyFromUrl(String url);
}
