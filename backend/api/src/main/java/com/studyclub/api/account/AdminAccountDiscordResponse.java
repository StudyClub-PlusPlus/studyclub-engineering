package com.studyclub.api.account;

/** 디스코드 보기 응답. username만 반환하고 숫자 디스코드 ID는 반환하지 않는다. */
public record AdminAccountDiscordResponse(Long id, String discordHandle) {}
