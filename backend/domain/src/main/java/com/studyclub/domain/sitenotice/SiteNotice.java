package com.studyclub.domain.sitenotice;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/** 사이트 공지 — 캡틴이 올리고 누구나 읽는 글. */
@Entity
@Table(
        name = "SITE_NOTICE",
        indexes = {@Index(name = "idx_site_notice_removed_id", columnList = "REMOVED_AT, ID")})
public class SiteNotice extends BaseEntity {

    public static final int TITLE_MAX_LENGTH = 200;
    public static final int BODY_MAX_LENGTH = 20_000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "TITLE", nullable = false, length = TITLE_MAX_LENGTH)
    private String title;

    @Column(name = "BODY", nullable = false, columnDefinition = "text")
    private String body;

    /** 등록한 캡틴. ACCOUNT 와 FK 는 없다 — 탈퇴해도 공지는 남는다. 수정해도 바뀌지 않는다. */
    @Column(name = "AUTHOR_ACCOUNT_ID", nullable = false)
    private Long authorAccountId;

    @Column(name = "REMOVED_AT")
    private Instant removedAt;

    protected SiteNotice() {}

    public SiteNotice(Long authorAccountId, String title, String body) {
        this.authorAccountId = authorAccountId;
        this.title = normalizeTitle(title);
        this.body = normalizeBody(body);
    }

    public void edit(String title, String body) {
        this.title = normalizeTitle(title);
        this.body = normalizeBody(body);
    }

    public void remove(Instant now) {
        this.removedAt = now;
    }

    public boolean isRemoved() {
        return removedAt != null;
    }

    /** 앞뒤 공백을 자른 값을 저장한다. 글자 수는 {@code String.length()}(UTF-16 단위) 기준 — 이모지 하나가 2 로 센다. */
    private static String normalizeTitle(String title) {
        String trimmed = "";
        if (title != null) {
            trimmed = title.trim();
        }
        if (trimmed.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "title: 제목을 입력하세요.");
        }
        if (trimmed.length() > TITLE_MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "title: 제목은 " + TITLE_MAX_LENGTH + "자까지입니다.");
        }
        return trimmed;
    }

    /**
     * 본문은 글쓴이가 넣은 그대로 보인다 — 앞뒤 공백·줄바꿈을 자르지 않고 HTML 도 걸러 내지 않는다. 서버가 바꾸는 건 {@code \r\n} 을 {@code \n}
     * 으로 통일하는 것뿐이다.
     */
    private static String normalizeBody(String body) {
        if (body == null || body.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "body: 본문을 입력하세요.");
        }
        String normalized = body.replace("\r\n", "\n");
        if (normalized.length() > BODY_MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "body: 본문은 " + BODY_MAX_LENGTH + "자까지입니다.");
        }
        return normalized;
    }

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public Long getAuthorAccountId() {
        return authorAccountId;
    }

    public Instant getRemovedAt() {
        return removedAt;
    }
}
