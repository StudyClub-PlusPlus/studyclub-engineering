package com.studyclub.api.account;

/** 이메일 보기 응답. 이 응답만 이메일 원본을 담는다 — 목록은 가린 값({@code maskedEmail})만 준다. */
public record AdminAccountEmailResponse(Long id, String email) {}
