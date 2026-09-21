package com.studyclub.api.discord;

import java.util.List;

/**
 * 봇이 채널에 그대로 찍을 수 있는 결과. 연동 안 된 유저가 있어도, 아무도 못 찍어도 200 이다 — 호출은 정상이고 찍을 대상이 없을 뿐이다.
 *
 * <p>보이스 공부방 하나를 여러 반이 같이 쓰므로 결과는 <b>반별</b>로 나뉜다.
 *
 * @param groups 실제로 출석이 찍힌 반들
 * @param unmatched 계정 연동이 안 된 디스코드 유저 (Notion 44)
 * @param notParticipant 연동은 됐지만 이 스터디 명부에 없는 디스코드 유저
 * @param noMeeting 명부에는 있지만 그 반에 지금 찍을 회차가 없는 디스코드 유저
 */
public record DiscordAttendanceResponse(
        List<MarkedGroup> groups,
        List<String> unmatched,
        List<String> notParticipant,
        List<String> noMeeting) {

    /**
     * @param meetingStarted 이 호출이 예정 회차를 시작시켰으면 true
     */
    public record MarkedGroup(
            Long studyGroupId, Long studyMeetingId, boolean meetingStarted, List<String> marked) {}
}
