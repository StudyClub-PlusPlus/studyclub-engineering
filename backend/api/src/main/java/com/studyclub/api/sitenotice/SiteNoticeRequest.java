package com.studyclub.api.sitenotice;

import jakarta.validation.constraints.NotBlank;

/** 공지 등록·수정 요청. 길이 상한은 여기서 보지 않는다. 제목은 앞뒤 공백을 자른 뒤에 200자를 재야 하고, 그 규칙은 {@code SiteNotice} 가 가진다. */
public record SiteNoticeRequest(@NotBlank String title, @NotBlank String body) {}
