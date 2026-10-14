package com.studyclub.api.upload;

import com.studyclub.api.storage.ObjectStorage;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.storage.StorageObject;
import com.studyclub.domain.storage.StorageObjectRepository;
import com.studyclub.domain.storage.StorageObjectStatus;
import com.studyclub.domain.storage.StorageProvider;
import com.studyclub.domain.storage.StoragePurpose;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 올리기 · 연결 · 지우기 찜 · 커밋 뒤 삭제 · 정리 배치. 저장소 호출은 전부 트랜잭션 밖이다 — 외부 네트워크를 기다리는 동안 DB 잠금을 잡지 않는다.
 *
 * <p>상태 전이는 {@link StorageObjectRepository} 의 조건부 UPDATE 로만 하고 바뀐 행 수로 판단한다. 조회하고 나서 바꾸면 그 사이에 배치가
 * 끼어든다.
 */
@Service
public class UploadService {

    private static final Logger log = LoggerFactory.getLogger(UploadService.class);

    /** 지금 올리는 저장소. 다른 저장소로 옮길 때 여기만 바꾼다 — 옛 파일은 행의 PROVIDER 로 제 저장소에서 지운다. */
    static final StorageProvider ACTIVE_PROVIDER = StorageProvider.S3;

    public record Uploaded(Long fileId, String url) {}

    private final List<ObjectStorage> storages;
    private final StorageObjectRepository repository;
    private final int pendingLimit;
    private final Duration pendingRetention;

    /** 커밋 뒤 콜백 안에서 행을 지울 때 쓴다 — 거기서는 원래 트랜잭션이 이미 끝나 있어 새 트랜잭션이어야 실제로 커밋된다. */
    private final TransactionTemplate newTransaction;

    private final TransactionTemplate transaction;

    public UploadService(
            List<ObjectStorage> storages,
            StorageObjectRepository repository,
            PlatformTransactionManager transactionManager,
            @Value("${upload.pending-limit:20}") int pendingLimit,
            @Value("${upload.pending-retention-hours:24}") long pendingRetentionHours) {
        this.storages = storages;
        this.repository = repository;
        this.pendingLimit = pendingLimit;
        this.pendingRetention = Duration.ofHours(pendingRetentionHours);
        this.newTransaction = new TransactionTemplate(transactionManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.transaction = new TransactionTemplate(transactionManager);
    }

    /**
     * 형식 판정 → 메타데이터 제거 → 저장소에 올리기 → {@code PENDING} 행. 어디에 쓸지는 아직 정하지 않아도 된다.
     *
     * <p>순서가 중요하다: 저장소에 먼저 올리고 행을 넣는다. 반대로 하면 행은 있는데 파일이 없는 상태가 생기고, 그 행을 연결하면 깨진 주소가 프로필에 박힌다. 행
     * INSERT 가 실패하면 방금 올린 파일을 지운다 — 행이 없으면 배치도 못 찾는다.
     */
    public Uploaded upload(Long accountId, StoragePurpose purpose, byte[] original) {
        if (original == null || original.length == 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "파일이 비어 있습니다.");
        }
        ImageFormat format =
                ImageSanitizer.detect(original)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.INVALID_INPUT,
                                                "jpeg, png, webp 파일만 올릴 수 있습니다."));
        byte[] bytes = ImageSanitizer.strip(original, format);
        ObjectStorage storage = activeStorage();
        if (repository.countByAccountIdAndStatus(accountId, StorageObjectStatus.PENDING)
                >= pendingLimit) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "올린 뒤 쓰지 않은 사진이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        }
        String key = purpose.folder() + "/" + UUID.randomUUID() + "." + format.extension();
        storage.put(key, bytes, format.contentType());
        StorageObject saved;
        try {
            saved =
                    repository.save(
                            new StorageObject(
                                    accountId,
                                    purpose,
                                    storage.provider(),
                                    key,
                                    format.contentType(),
                                    bytes.length));
        } catch (RuntimeException e) {
            deleteFileQuietly(storage, key);
            throw e;
        }
        return new Uploaded(saved.getId(), storage.publicUrl(key));
    }

    /**
     * 연결 — 호출자의 트랜잭션 안에서 부른다. 번호가 없든, 남의 것이든, 용도가 다르든, 이미 연결됐든, 만료됐든 같은 400 이다. 사유를 구분하지 않는 건 어떤
     * 번호가 존재하는지 응답으로 알 수 없게 하려는 것.
     */
    public StorageObject attach(Long fileId, Long accountId, StoragePurpose purpose, Instant now) {
        if (fileId == null || repository.attach(fileId, accountId, purpose, now) == 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "업로드한 사진을 찾을 수 없습니다. 다시 올려 주세요.");
        }
        return repository
                .findById(fileId)
                .orElseThrow(() -> new IllegalStateException("방금 연결한 행이 없다 id=" + fileId));
    }

    public String publicUrl(StorageObject object) {
        return storageFor(object.getProvider()).publicUrl(object.getObjectKey());
    }

    /**
     * 주소가 우리 파일이면 그 행을 {@code DELETING} 으로 찜한다. 구글 사진·null 이면 비어 있다 — DB 값만 바꾸면 된다. 호출자의 트랜잭션 안에서
     * 부른다.
     */
    public Optional<StorageObject> markDeletingByUrl(String url, Instant now) {
        if (url == null) {
            return Optional.empty();
        }
        for (ObjectStorage storage : storages) {
            Optional<String> key = storage.keyFromUrl(url);
            if (key.isPresent()) {
                return repository
                        .findByObjectKey(key.get())
                        .filter(object -> repository.markDeleting(object.getId(), now) == 1);
            }
        }
        return Optional.empty();
    }

    /** 탈퇴 — 그 계정의 연결된·연결 안 된 파일을 전부 찜하고 돌려준다. 호출자의 트랜잭션 안에서 부른다. */
    public List<StorageObject> markDeletingByAccount(Long accountId, Instant now) {
        repository.markDeletingByAccountId(accountId, now);
        return repository.findAllByAccountIdAndStatus(accountId, StorageObjectStatus.DELETING);
    }

    /**
     * 커밋 뒤에 파일 → 행 순으로 지운다. 실패해도 응답은 성공이고, 행이 {@code DELETING} 으로 남아 배치가 다시 지운다. 트랜잭션이 없으면 바로 지운다.
     */
    public void deleteAfterCommit(List<StorageObject> objects) {
        if (objects.isEmpty()) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            objects.forEach(this::deleteQuietly);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        objects.forEach(UploadService.this::deleteQuietly);
                    }
                });
    }

    /**
     * 정리 배치. 1단계 — 하루 지난 {@code PENDING} 을 {@code DELETING} 으로 찜한다. 2단계 — {@code DELETING} 행을 전부 읽어
     * 하나씩 파일 삭제 → 행 삭제. 교체·지우기·탈퇴가 남긴 것도 같이 치운다.
     *
     * <p>찜하기를 먼저 하는 이유는 연결과의 경쟁이다. 어느 순서든 한쪽만 이긴다. 서버 두 대가 2단계에서 같은 행을 집어도 저장소는 없는 키를 지워도 성공이라 괜찮다.
     * 설정이 없으면 아무것도 안 한다.
     */
    public void cleanUp(Instant now) {
        ObjectStorage storage = storageFor(ACTIVE_PROVIDER);
        if (!storage.isConfigured()) {
            return;
        }
        Instant before = now.minus(pendingRetention);
        Integer claimed =
                transaction.execute(status -> repository.claimExpiredPending(before, now));
        List<StorageObject> deleting = repository.findAllByStatus(StorageObjectStatus.DELETING);
        int deleted = 0;
        for (StorageObject object : deleting) {
            if (deleteQuietly(object)) {
                deleted++;
            }
        }
        if (claimed != null && claimed > 0 || !deleting.isEmpty()) {
            log.info("업로드 정리 — 만료 찜 {}건, 삭제 {}/{}건", claimed, deleted, deleting.size());
        }
    }

    /** 파일 삭제 → 행 삭제. 실패해도 던지지 않는다 — 행이 {@code DELETING} 으로 남아 다음 배치가 다시 시도한다. */
    private boolean deleteQuietly(StorageObject object) {
        try {
            storageFor(object.getProvider()).delete(object.getObjectKey());
            newTransaction.executeWithoutResult(status -> repository.deleteById(object.getId()));
            return true;
        } catch (RuntimeException e) {
            log.warn(
                    "파일 삭제 실패 — 배치가 다시 시도한다 id={} key={}",
                    object.getId(),
                    object.getObjectKey(),
                    e);
            return false;
        }
    }

    private void deleteFileQuietly(ObjectStorage storage, String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            log.warn("행 없이 남은 파일을 지우지 못했다 key={}", key, e);
        }
    }

    private ObjectStorage activeStorage() {
        ObjectStorage storage = storageFor(ACTIVE_PROVIDER);
        if (!storage.isConfigured()) {
            throw new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "파일 저장소가 설정되지 않았습니다.");
        }
        return storage;
    }

    private ObjectStorage storageFor(StorageProvider provider) {
        return storages.stream()
                .filter(storage -> storage.provider() == provider)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("저장소 구현이 없다 provider=" + provider));
    }
}
