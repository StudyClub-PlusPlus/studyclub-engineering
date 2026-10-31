package com.studyclub.domain.storage;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 상태 전이는 전부 조건부 UPDATE 다. 바뀐 행 수(0 또는 1)로 성공을 판단한다 — 조회하고 나서 바꾸는 두 단계로 하면 그 사이에 배치가 끼어든다.
 *
 * <p>{@code clearAutomatically} 는 켜지 않는다. 켜면 호출자가 같은 트랜잭션에서 잠가 둔 계정 엔티티까지 떼어내 그 뒤 변경이 저장되지 않는다. 대신
 * UPDATE 뒤에 그 행을 읽는 쪽은 이 트랜잭션에서 아직 읽은 적 없는 행만 읽는다 — 그래야 DB 의 새 값이 온다.
 */
public interface StorageObjectRepository extends JpaRepository<StorageObject, Long> {

    /**
     * 연결 — 「이 번호가, 내 것이고, 용도가 맞고, 아직 연결 안 됐을 때만」 {@code ATTACHED}.
     *
     * @return 1 이면 연결됨. 0 이면 번호 없음·남의 것·용도 다름·이미 연결·만료 중 하나 — 호출자는 사유를 구분하지 않는다
     */
    @Modifying(flushAutomatically = true)
    @Query(
            """
            UPDATE StorageObject s
            SET s.status = com.studyclub.domain.storage.StorageObjectStatus.ATTACHED,
                s.attachedAt = :now,
                s.updatedAt = :now
            WHERE s.id = :id
              AND s.accountId = :accountId
              AND s.purpose = :purpose
              AND s.status = com.studyclub.domain.storage.StorageObjectStatus.PENDING
            """)
    int attach(
            @Param("id") Long id,
            @Param("accountId") Long accountId,
            @Param("purpose") StoragePurpose purpose,
            @Param("now") Instant now);

    /**
     * 연결된 파일을 지우기로 찜한다 — 교체·지우기가 옛 파일에 쓴다. 내 것이고 {@code ATTACHED} 일 때만 바뀐다. 주인을 거는 이유: 주소 칸에 남의 파일
     * 주소가 들어가도(다른 기능이 같은 칸을 쓰게 될 때 등) 남의 파일을 지우지 않게.
     *
     * @return 1 이면 찜함. 0 이면 이미 지우는 중·남의 것·없는 행
     */
    @Modifying(flushAutomatically = true)
    @Query(
            """
            UPDATE StorageObject s
            SET s.status = com.studyclub.domain.storage.StorageObjectStatus.DELETING,
                s.updatedAt = :now
            WHERE s.id = :id
              AND s.accountId = :accountId
              AND s.status = com.studyclub.domain.storage.StorageObjectStatus.ATTACHED
            """)
    int markDeleting(
            @Param("id") Long id, @Param("accountId") Long accountId, @Param("now") Instant now);

    /**
     * 연결된 파일을 용도 조건으로 찜한다 — 스터디 썸네일처럼 여러 운영자가 고치는 자원용. 주인 대신 용도를 건다: 주소 칸에 다른 용도의 파일(남의 프로필 사진 등)이
     * 들어가도 지우지 않게.
     */
    @Modifying(flushAutomatically = true)
    @Query(
            """
            UPDATE StorageObject s
            SET s.status = com.studyclub.domain.storage.StorageObjectStatus.DELETING,
                s.updatedAt = :now
            WHERE s.id = :id
              AND s.purpose = :purpose
              AND s.status = com.studyclub.domain.storage.StorageObjectStatus.ATTACHED
            """)
    int markDeletingForPurpose(
            @Param("id") Long id,
            @Param("purpose") StoragePurpose purpose,
            @Param("now") Instant now);

    /**
     * 정리 배치 1단계 — 올린 지 {@code before} 보다 오래된 {@code PENDING} 을 전부 {@code DELETING} 으로 찜한다. 배치가 먼저
     * 찜하면 그 뒤에 온 연결은 {@link #attach} 의 {@code PENDING} 조건에 안 맞아 실패한다. 어느 순서든 한쪽만 이긴다.
     */
    @Modifying(flushAutomatically = true)
    @Query(
            """
            UPDATE StorageObject s
            SET s.status = com.studyclub.domain.storage.StorageObjectStatus.DELETING,
                s.updatedAt = :now
            WHERE s.status = com.studyclub.domain.storage.StorageObjectStatus.PENDING
              AND s.createdAt < :before
            """)
    int claimExpiredPending(@Param("before") Instant before, @Param("now") Instant now);

    /**
     * 탈퇴 — 그 계정의 프로필 사진 · 문의 첨부 이미지와 연결 안 된 파일을 지우기로 찜한다. 다른 자원에 붙은 파일(스터디 썸네일 등)은 그 자원의 것이라 남긴다 —
     * 운영자가 탈퇴해도 그가 올린 썸네일은 깨지지 않아야 한다. 이미 {@code DELETING} 인 행은 그대로.
     */
    @Modifying(flushAutomatically = true)
    @Query(
            """
            UPDATE StorageObject s
            SET s.status = com.studyclub.domain.storage.StorageObjectStatus.DELETING,
                s.updatedAt = :now
            WHERE s.accountId = :accountId
              AND (s.status = com.studyclub.domain.storage.StorageObjectStatus.PENDING
                   OR (s.status = com.studyclub.domain.storage.StorageObjectStatus.ATTACHED
                       AND s.purpose IN (com.studyclub.domain.storage.StoragePurpose.PROFILE,
                                         com.studyclub.domain.storage.StoragePurpose.FEEDBACK)))
            """)
    int markDeletingByAccountId(@Param("accountId") Long accountId, @Param("now") Instant now);

    /** 주소에서 뽑은 키로 행을 찾는다. 키는 UNIQUE 라 하나만 돌아온다. */
    Optional<StorageObject> findByObjectKey(String objectKey);

    /** 올리기 전 그 계정의 {@code PENDING} 수 — 상한(20) 검사. */
    long countByAccountIdAndStatus(Long accountId, StorageObjectStatus status);

    /** 정리 배치 2단계 — 지우기로 찜한 행 전부. */
    List<StorageObject> findAllByStatus(StorageObjectStatus status);

    /** 탈퇴 — 방금 찜한 그 계정의 행. 커밋 뒤 삭제 목록. */
    List<StorageObject> findAllByAccountIdAndStatus(Long accountId, StorageObjectStatus status);
}
