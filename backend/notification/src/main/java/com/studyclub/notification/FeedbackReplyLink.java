package com.studyclub.notification;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 요청에서 받은 주소가 아니라 서버에 설정한 사용자 사이트로만 연결한다. */
@Component
public class FeedbackReplyLink {
    private final String siteBaseUrl;

    public FeedbackReplyLink(@Value("${notification.site-base-url}") String siteBaseUrl) {
        URI uri = URI.create(siteBaseUrl);
        if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
                || uri.getHost() == null
                || uri.getRawUserInfo() != null
                || uri.getRawQuery() != null
                || uri.getRawFragment() != null
                || !(uri.getPath().isEmpty() || uri.getPath().equals("/"))) {
            throw new IllegalArgumentException(
                    "notification.site-base-url 은 http(s) 사이트 주소여야 합니다.");
        }
        this.siteBaseUrl = siteBaseUrl.replaceAll("/+$", "");
    }

    public String forFeedback(Long feedbackId) {
        return siteBaseUrl + "/ko/my/feedbacks/" + feedbackId;
    }
}
