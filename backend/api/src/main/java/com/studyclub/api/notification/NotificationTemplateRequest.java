package com.studyclub.api.notification;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.studyclub.notification.NotificationEventType;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;

/**
 * 템플릿 추가·수정 요청. 채널은 받지 않는다 — 지금 보낼 수 있는 것은 메일뿐이라 서버가 정한다. 제목은 {@code VARCHAR(255)} 라 글자 수로, 본문은
 * {@code TEXT} 한도(65,535바이트)라 UTF-8 바이트로 센다 (specs/notification/spec.md). {@code @Size} 는 글자 수만 세서
 * 본문은 아래 메서드로 검사한다.
 */
public record NotificationTemplateRequest(
        @NotNull NotificationEventType eventType,
        @NotBlank @Size(max = SUBJECT_MAX_LENGTH) String subject,
        @NotBlank String body) {

    public static final int SUBJECT_MAX_LENGTH = 255;
    public static final int BODY_MAX_BYTES = 65_535;

    @JsonIgnore
    @AssertTrue(message = "본문은 65,535바이트(UTF-8)를 넘을 수 없습니다")
    public boolean isBodyWithinByteLimit() {
        return body == null || body.getBytes(StandardCharsets.UTF_8).length <= BODY_MAX_BYTES;
    }
}
