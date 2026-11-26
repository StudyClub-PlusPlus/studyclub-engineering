package com.studyclub.notification;

import java.net.URI;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 요청 헤더가 아닌 서버 설정의 백오피스로만 연결한다. */
@Component
public class StudyApplicationLink {
    private final String baseUrl;

    public StudyApplicationLink(@Value("${notification.back-office-base-url}") String baseUrl) {
        var origins =
                Arrays.stream(baseUrl.split(",", -1))
                        .map(String::trim)
                        .filter(value -> !value.isEmpty())
                        .map(value -> value.replaceAll("/+$", ""))
                        .distinct()
                        .toList();
        if (origins.size() != 1) {
            throw new IllegalArgumentException(
                    "백오피스 주소가 여러 개이거나 비어 있으면 NOTIFICATION_BACK_OFFICE_BASE_URL 을 지정해야 합니다.");
        }
        URI uri = URI.create(origins.getFirst());
        if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
                || uri.getHost() == null
                || uri.getRawUserInfo() != null
                || uri.getRawQuery() != null
                || uri.getRawFragment() != null
                || !(uri.getPath().isEmpty() || uri.getPath().equals("/"))) {
            throw new IllegalArgumentException(
                    "notification.back-office-base-url 은 http(s) 사이트 주소여야 합니다.");
        }
        this.baseUrl = origins.getFirst();
    }

    public String forStudy(Long studyId) {
        return baseUrl + "/studies/" + studyId + "?tab=crew";
    }
}
