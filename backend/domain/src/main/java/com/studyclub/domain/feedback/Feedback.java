package com.studyclub.domain.feedback;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
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
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * 크루가 보낸 문의·오류 신고 하나와 캡틴의 처리(상태 · 회신 · 메모). specs/feedback/spec.md
 *
 * <p><b>완료는 회신으로만 된다.</b> {@code STATUS = DONE ⇔ 회신 있음 ⇔ 완료 처리자 있음} 을 이 클래스의 메서드가 지킨다 — 제출자에게 보이는
 * 「답변 완료」와 실제 답변이 어긋나지 않게 (PR #341 리뷰). 첨부 이미지는 {@link FeedbackImage} 가 따로 든다.
 */
@Entity
@Table(
        name = "FEEDBACK",
        indexes = {
            @Index(name = "idx_feedback_account_created", columnList = "ACCOUNT_ID, CREATED_AT"),
            @Index(name = "idx_feedback_created", columnList = "CREATED_AT")
        })
public class Feedback extends BaseEntity {

    public static final int TITLE_MIN = 2;
    public static final int TITLE_MAX = 100;
    public static final int CONTENT_MIN = 10;
    public static final int CONTENT_MAX = 2000;
    public static final int REPLY_MIN = 10;
    public static final int REPLY_MAX = 2000;
    public static final int ADMIN_MEMO_MAX = 2000;
    public static final int BROWSER_MAX = 60;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 제출자. ACCOUNT 와 FK 는 없다 — 탈퇴로 행이 지워지면 「탈퇴한 사용자」. */
    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "TYPE", nullable = false, length = 20)
    private FeedbackType type;

    @Column(name = "TITLE", nullable = false, length = TITLE_MAX)
    private String title;

    /** 평문. 받은 글자 그대로 — HTML 로 해석하지도 지우지도 않는다. */
    @Column(name = "CONTENT", nullable = false, length = CONTENT_MAX)
    private String content;

    /** 「Chrome 141 · macOS」. 서버가 User-Agent 헤더를 줄인 값이고 원문은 남기지 않는다. 모르면 null. */
    @Column(name = "BROWSER", length = BROWSER_MAX)
    private String browser;

    @Column(name = "VIEWPORT_WIDTH")
    private Integer viewportWidth;

    @Column(name = "VIEWPORT_HEIGHT")
    private Integer viewportHeight;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private FeedbackStatus status;

    /** 첫 회신을 보낸 캡틴 = 완료 처리자. 완료가 아니면 null. */
    @Column(name = "DONE_BY_ACCOUNT_ID")
    private Long doneByAccountId;

    @Column(name = "REPLY_CONTENT", length = REPLY_MAX)
    private String replyContent;

    /** 첫 회신 시각. 회신을 고쳐도 그대로다. */
    @Column(name = "REPLIED_AT")
    private Instant repliedAt;

    @Column(name = "ADMIN_MEMO", length = ADMIN_MEMO_MAX)
    private String adminMemo;

    protected Feedback() {}

    /** 새 문의는 늘 「미확인」으로 시작한다. 길이 검증은 호출자(제출 서비스)가 끝낸 뒤다. */
    public Feedback(
            Long accountId,
            FeedbackType type,
            String title,
            String content,
            String browser,
            Integer viewportWidth,
            Integer viewportHeight) {
        this.accountId = accountId;
        this.type = type;
        this.title = title;
        this.content = content;
        this.browser = browser;
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        this.status = FeedbackStatus.NEW;
    }

    public boolean isAnswered() {
        return replyContent != null;
    }

    /** 제출자에게 보이는 상태. 운영 단계(미확인 · 확인)는 묶어서 「접수」다. */
    public FeedbackSubmitterStatus submitterStatus() {
        return status == FeedbackStatus.DONE
                ? FeedbackSubmitterStatus.ANSWERED
                : FeedbackSubmitterStatus.RECEIVED;
    }

    /** 운영 상세의 상태 드롭다운에서 지금 고를 수 있는 값. {@link #changeStatus} 가 막는 것과 같은 규칙이다. */
    public List<FeedbackStatus> selectableStatuses() {
        return isAnswered() ? List.of() : List.of(FeedbackStatus.NEW, FeedbackStatus.SEEN);
    }

    /**
     * 미확인 ↔ 확인. 같은 값이면 아무것도 바꾸지 않는다. 회신한 건은 완료로 고정이고, 완료는 회신으로만 된다.
     *
     * @return 실제로 바뀌었으면 true
     */
    public boolean changeStatus(FeedbackStatus next) {
        if (next == status) {
            return false;
        }
        if (isAnswered()) {
            throw new BusinessException(ErrorCode.FEEDBACK_ALREADY_ANSWERED);
        }
        if (next == FeedbackStatus.DONE) {
            throw new BusinessException(ErrorCode.FEEDBACK_REPLY_REQUIRED);
        }
        this.status = next;
        return true;
    }

    /**
     * 회신. 첫 회신이면 완료로 바꾸고 보낸 캡틴을 완료 처리자로 남긴다. 이미 회신이 있으면 내용만 고친다 — 시각 · 상태 · 처리자는 그대로다.
     *
     * @return 첫 회신이었으면 true
     */
    public boolean reply(String content, Long adminAccountId, Instant now) {
        boolean first = !isAnswered();
        this.replyContent = content;
        if (first) {
            // DATETIME(6) 정밀도에 맞춰 첫 응답과 DB 재조회 뒤의 회신 시각을 같게 유지한다.
            this.repliedAt = now.truncatedTo(ChronoUnit.MICROS);
            this.status = FeedbackStatus.DONE;
            this.doneByAccountId = adminAccountId;
        }
        return first;
    }

    /** 캡틴 전용 메모. 빈 문자열은 지운 것으로 본다. */
    public void changeAdminMemo(String memo) {
        this.adminMemo = memo == null || memo.isEmpty() ? null : memo;
    }

    public Long getId() {
        return id;
    }

    public Long getAccountId() {
        return accountId;
    }

    public FeedbackType getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public String getBrowser() {
        return browser;
    }

    public Integer getViewportWidth() {
        return viewportWidth;
    }

    public Integer getViewportHeight() {
        return viewportHeight;
    }

    public FeedbackStatus getStatus() {
        return status;
    }

    public Long getDoneByAccountId() {
        return doneByAccountId;
    }

    public String getReplyContent() {
        return replyContent;
    }

    public Instant getRepliedAt() {
        return repliedAt;
    }

    public String getAdminMemo() {
        return adminMemo;
    }
}
