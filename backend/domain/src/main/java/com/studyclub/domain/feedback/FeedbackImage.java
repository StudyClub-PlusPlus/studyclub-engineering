package com.studyclub.domain.feedback;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 문의에 첨부한 이미지 한 장. 문의 애그리거트 안이라 FEEDBACK 과는 FK 로 묶이고(마이그레이션), 업로드 행(STORAGE_OBJECT)과는 ID 로만 잇는다.
 *
 * <p>공개 주소는 두지 않는다 — 파일은 비공개 폴더에 있고, 권한을 확인하는 API 가 읽어서 내준다.
 */
@Entity
@Table(
        name = "FEEDBACK_IMAGE",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_feedback_image_feedback_order",
                        columnNames = {"FEEDBACK_ID", "DISPLAY_ORDER"}),
        indexes =
                @Index(
                        name = "idx_feedback_image_storage_object",
                        columnList = "STORAGE_OBJECT_ID"))
public class FeedbackImage extends BaseEntity {

    /** 한 문의에 붙는 최대 장수. */
    public static final int MAX_PER_FEEDBACK = 3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "FEEDBACK_ID", nullable = false)
    private Long feedbackId;

    @Column(name = "STORAGE_OBJECT_ID", nullable = false)
    private Long storageObjectId;

    /** 0부터. 제출 때 고른 순서. */
    @Column(name = "DISPLAY_ORDER", nullable = false)
    private int displayOrder;

    protected FeedbackImage() {}

    public FeedbackImage(Long feedbackId, Long storageObjectId, int displayOrder) {
        this.feedbackId = feedbackId;
        this.storageObjectId = storageObjectId;
        this.displayOrder = displayOrder;
    }

    public Long getId() {
        return id;
    }

    public Long getFeedbackId() {
        return feedbackId;
    }

    public Long getStorageObjectId() {
        return storageObjectId;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }
}
