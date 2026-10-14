package com.studyclub.api.meeting;

import java.time.Instant;
import java.util.List;

/** 스터디 일정 화면 한 장 — 정보 카드 · 규칙 · 내 권한 · 발표자 후보 · 회차 (specs/study-meeting/spec.md 「분반 회차 목록」). */
public record StudyMeetingListResponse(
        StudyView study,
        StudyGroupView studyGroup,
        MeView me,
        List<ParticipantView> participants,
        List<MeetingView> meetings) {

    /** 정보 카드의 「디스코드」 · 「자료실」 버튼. 비어 있으면 버튼을 두지 않는다. */
    public record StudyView(Long id, String title, String discordChannelUrl, String driveUrl) {}

    /** {@code startTime} 은 분반 시간대의 현지 {@code HH:mm} — 추가 창 시작 시각 기본값. */
    public record StudyGroupView(
            Long id,
            String name,
            String timezone,
            String startTime,
            String navigatorName,
            String rules) {}

    /** {@code participantId} 는 명부에 없는 (만든) 캡틴이면 null. {@code canEdit} 이 true 면 표를 고칠 수 있게 연다. */
    public record MeView(Long participantId, boolean canEdit) {}

    /** 발표자 드롭다운 후보 — 그 분반 활성 참여자, 이름순. */
    public record ParticipantView(Long participantId, String name) {}

    /** 발표자 칸. {@code active} 가 false 면 참여를 중단한 사람 — 화면은 「이름 (참여 종료)」. */
    public record PresenterView(Long participantId, String name, boolean active) {}

    /** {@code number} 는 저장하지 않고 센다 — 킥오프 0, 정규 회차는 예정 시각 순서로 1부터. */
    public record MeetingView(
            Long id,
            String type,
            int number,
            Instant scheduledAt,
            String title,
            PresenterView presenter1,
            PresenterView presenter2,
            boolean started) {}
}
