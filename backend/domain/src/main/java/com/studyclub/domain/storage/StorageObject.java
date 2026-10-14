package com.studyclub.domain.storage;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * 오브젝트 스토리지에 올린 파일 하나. 파일 자체는 저장소에 있고, 이 행은 「누가 어떤 용도로 어디에 올렸고 지금 쓰이고 있나」 만 안다.
 *
 * <p>상태 전이 메서드가 없는 이유: 전이는 전부 {@link StorageObjectRepository} 의 조건부 UPDATE 로만 한다. 엔티티를 읽어서 바꾸면 「읽기
 * → 쓰기」 사이에 배치가 끼어들 수 있다.
 */
@Entity
@Table(
        name = "STORAGE_OBJECT",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "uk_storage_object_key",
                    columnNames = {"OBJECT_KEY"})
        },
        indexes = {
            @Index(name = "idx_storage_object_status_created", columnList = "STATUS, CREATED_AT"),
            @Index(name = "idx_storage_object_account_status", columnList = "ACCOUNT_ID, STATUS")
        })
public class StorageObject extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 올린 사람. ACCOUNT 와 FK 는 없다 — 애그리거트 간 참조. */
    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "PURPOSE", nullable = false, length = 20)
    private StoragePurpose purpose;

    @Enumerated(EnumType.STRING)
    @Column(name = "PROVIDER", nullable = false, length = 20)
    private StorageProvider provider;

    /** 저장소 안의 위치. {@code gigs/profiles/<UUID>.webp} 꼴. 교체·지우기가 주소에서 키를 뽑아 이 행을 찾는다. */
    @Column(name = "OBJECT_KEY", nullable = false, length = 512)
    private String objectKey;

    /** 파일 내용으로 판정한 형식. 브라우저가 보낸 값이 아니다. */
    @Column(name = "CONTENT_TYPE", nullable = false, length = 40)
    private String contentType;

    /** 메타데이터를 지운 뒤 저장한 바이트 수. */
    @Column(name = "SIZE", nullable = false)
    private long size;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private StorageObjectStatus status;

    /** 연결 시각. {@code PENDING} 이면 null. */
    @Column(name = "ATTACHED_AT")
    private Instant attachedAt;

    protected StorageObject() {}

    /** 새로 올린 파일은 항상 {@code PENDING} 으로 시작한다. */
    public StorageObject(
            Long accountId,
            StoragePurpose purpose,
            StorageProvider provider,
            String objectKey,
            String contentType,
            long size) {
        this.accountId = accountId;
        this.purpose = purpose;
        this.provider = provider;
        this.objectKey = objectKey;
        this.contentType = contentType;
        this.size = size;
        this.status = StorageObjectStatus.PENDING;
    }

    public Long getId() {
        return id;
    }

    public Long getAccountId() {
        return accountId;
    }

    public StoragePurpose getPurpose() {
        return purpose;
    }

    public StorageProvider getProvider() {
        return provider;
    }

    public String getObjectKey() {
        return objectKey;
    }

    public String getContentType() {
        return contentType;
    }

    public long getSize() {
        return size;
    }

    public StorageObjectStatus getStatus() {
        return status;
    }

    public Instant getAttachedAt() {
        return attachedAt;
    }
}
