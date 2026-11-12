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
 * <p>주소는 연결할 때의 공개 주소를 그대로 적어 둔다 — {@code ACCOUNT.PROFILE_IMG_URL} 과 같은 방식.
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

    @Column(name = "IMAGE_URL", nullable = false, length = 512)
    private String imageUrl;

    /** 0부터. 제출 때 고른 순서. */
    @Column(name = "DISPLAY_ORDER", nullable = false)
    private int displayOrder;

    protected FeedbackImage() {}

    public FeedbackImage(Long feedbackId, Long storageObjectId, String imageUrl, int displayOrder) {
        this.feedbackId = feedbackId;
        this.storageObjectId = storageObjectId;
        this.imageUrl = imageUrl;
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

    public String getImageUrl() {
        return imageUrl;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }
}
