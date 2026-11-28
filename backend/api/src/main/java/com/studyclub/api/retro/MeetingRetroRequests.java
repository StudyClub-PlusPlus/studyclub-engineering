package com.studyclub.api.retro;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 회고 작성·수정 요청. 길이·공백 검증은 서비스에서 strip() 뒤에 한다. */
public final class MeetingRetroRequests {

    private MeetingRetroRequests() {}

    public record WriteRetro(
            @NotBlank @Size(max = 500) String good,
            @NotBlank @Size(max = 500) String improve,
            @Size(max = 500) String feeling) {}
}
