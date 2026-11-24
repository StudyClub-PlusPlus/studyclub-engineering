package com.studyclub.api.feedback;

/**
 * 첨부 이미지 한 장. 내 문의 상세와 운영 상세가 같이 쓴다. {@code url} 은 공개 주소가 아니라 이 API 의 경로다 — 로그인 쿠키를 싣고 요청해야 열린다
 * (specs/feedback/spec.md).
 */
public record FeedbackImageUrl(Long id, String url) {}
