package com.studyclub.api.discord;

import java.util.List;

/**
 * 봇이 채널에 그대로 찍을 수 있는 결과. 연동 안 된 유저가 있어도 200 이다 — 호출은 정상이고 데이터가 없을 뿐이다.
 *
 * @param studyMeetingId 실제로 출석이 찍힌 회차
 * @param meetingStarted 이 호출이 예정 회차를 시작시켰으면 true
 * @param marked 출석 처리된 디스코드 유저
 * @param unmatched 계정 연동이 안 된 디스코드 유저 (Notion 44)
 * @param notParticipant 연동은 됐지만 이 반 명부에 없는 디스코드 유저
 */
public record DiscordAttendanceResponse(
        Long studyMeetingId,
        boolean meetingStarted,
        List<String> marked,
        List<String> unmatched,
        List<String> notParticipant) {}
