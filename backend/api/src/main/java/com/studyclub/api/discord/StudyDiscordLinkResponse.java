package com.studyclub.api.discord;

/** snowflake 는 문자열로 내보낸다 — JSON 숫자면 JS 호출자에서 정밀도가 깨진다. */
public record StudyDiscordLinkResponse(String discordStudyId, String discordRoleId) {}
