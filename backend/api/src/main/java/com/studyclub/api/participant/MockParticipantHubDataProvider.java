package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubResponses.StudyApplicationSummary;
import com.studyclub.api.participant.ParticipantHubResponses.StudyMeetingAttendance;
import com.studyclub.api.participant.ParticipantHubResponses.BookmarkedStudySummary;
import com.studyclub.api.participant.ParticipantHubResponses.ParticipantHubOverviewResponse;
import com.studyclub.api.participant.ParticipantHubResponses.ParticipatingStudyCohortDetailResponse;
import com.studyclub.api.participant.ParticipantHubResponses.ParticipatingStudySummary;
import com.studyclub.api.participant.ParticipantHubResponses.UpcomingStudyMeeting;
import com.studyclub.domain.application.ApplicationStatusEnum;
import com.studyclub.domain.attendance.AttendanceStatusEnum;
import com.studyclub.domain.participant.ParticipantStatusEnum;
import com.studyclub.domain.study.StudyCohortStatusEnum;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class MockParticipantHubDataProvider implements ParticipantHubDataProvider {

    private static final String MOCK_ACCOUNT_EMAIL = "member@example.com";
    private static final Set<Long> KNOWN_COHORT_IDS = Set.of(291L, 301L, 302L, 303L, 304L);

    @Override
    public ParticipantHubOverviewResponse getParticipantHubOverview(String accountEmail) {
        if (!MOCK_ACCOUNT_EMAIL.equalsIgnoreCase(accountEmail)) {
            return new ParticipantHubOverviewResponse(List.of(), List.of(), List.of(), List.of(), List.of());
        }
        return new ParticipantHubOverviewResponse(
                List.of(
                        new ParticipatingStudySummary(301L, 101L, "AI 논문 읽기", ParticipantStatusEnum.ACTIVE, 100,
                                Instant.parse("2026-09-08T11:00:00Z"), "https://example.com/studies/101.png"),
                        new ParticipatingStudySummary(302L, 102L, "Spring Boot 딥다이브", ParticipantStatusEnum.ACTIVE, null,
                                Instant.parse("2026-09-12T10:00:00Z"), "https://example.com/studies/102.png")),
                List.of(
                        new ParticipatingStudySummary(291L, 91L, "개발자 글쓰기", ParticipantStatusEnum.COMPLETED, 88,
                                null, "https://example.com/studies/91.png")),
                List.of(
                        new StudyApplicationSummary(501L, 303L, 103L, "오픈소스 첫 기여", ApplicationStatusEnum.PENDING,
                                Instant.parse("2026-09-05T04:30:00Z")),
                        new StudyApplicationSummary(502L, 304L, 104L, "데이터 시각화", ApplicationStatusEnum.REJECTED,
                                Instant.parse("2026-08-20T02:00:00Z"))),
                List.of(
                        new UpcomingStudyMeeting(1004L, 301L, 101L, "AI 논문 읽기",
                                Instant.parse("2026-09-08T11:00:00Z")),
                        new UpcomingStudyMeeting(1101L, 302L, 102L, "Spring Boot 딥다이브",
                                Instant.parse("2026-09-12T10:00:00Z"))),
                List.of(
                        new BookmarkedStudySummary(
                                701L, 105L, "UX 리서치 북클럽", "https://example.com/studies/105.png")));
    }

    @Override
    public Optional<ParticipatingStudyCohortDetailResponse> findParticipatingStudyCohortDetail(
            String accountEmail, Long cohortId) {
        if (!MOCK_ACCOUNT_EMAIL.equalsIgnoreCase(accountEmail)) {
            return Optional.empty();
        }
        if (cohortId == 301L) {
            return Optional.of(ongoingStudy());
        }
        if (cohortId == 302L) {
            return Optional.of(upcomingStudy());
        }
        if (cohortId == 291L) {
            return Optional.of(completedStudy());
        }
        return Optional.empty();
    }

    @Override
    public boolean studyCohortExists(Long cohortId) {
        return KNOWN_COHORT_IDS.contains(cohortId);
    }

    private ParticipatingStudyCohortDetailResponse ongoingStudy() {
        return new ParticipatingStudyCohortDetailResponse(
                301L, 101L, "AI 논문 읽기", StudyCohortStatusEnum.OPEN, ParticipantStatusEnum.ACTIVE,
                "화요일반", "Asia/Seoul", "김○○",
                3, 12, 100, java.time.LocalDate.parse("2026-08-18"),
                new UpcomingStudyMeeting(1004L, 301L, 101L, "AI 논문 읽기",
                        Instant.parse("2026-09-08T11:00:00Z")),
                List.of(
                        completedAttendance(1001L, "2026-08-18T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(1002L, "2026-08-25T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(1003L, "2026-09-01T11:00:00Z", AttendanceStatusEnum.LATE),
                        new StudyMeetingAttendance(1004L, Instant.parse("2026-09-08T11:00:00Z"), null, null, null)),
                "https://drive.google.com/drive/folders/mock-ai-paper-cohort-3");
    }

    private ParticipatingStudyCohortDetailResponse upcomingStudy() {
        return new ParticipatingStudyCohortDetailResponse(
                302L, 102L, "Spring Boot 딥다이브", StudyCohortStatusEnum.OPEN, ParticipantStatusEnum.ACTIVE,
                "토요일반", "Asia/Seoul", "박○○",
                0, 8, null, java.time.LocalDate.parse("2026-09-12"),
                new UpcomingStudyMeeting(1101L, 302L, 102L, "Spring Boot 딥다이브",
                        Instant.parse("2026-09-12T10:00:00Z")),
                List.of(),
                "https://drive.google.com/drive/folders/mock-spring-boot-cohort-2");
    }

    private ParticipatingStudyCohortDetailResponse completedStudy() {
        return new ParticipatingStudyCohortDetailResponse(
                291L, 91L, "개발자 글쓰기", StudyCohortStatusEnum.CLOSED, ParticipantStatusEnum.COMPLETED,
                "수요일반", "Asia/Seoul", "이○○",
                8, 8, 88, java.time.LocalDate.parse("2026-05-06"), null,
                List.of(
                        completedAttendance(901L, "2026-05-06T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(902L, "2026-05-13T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(903L, "2026-05-20T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(904L, "2026-05-27T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(905L, "2026-06-03T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(906L, "2026-06-10T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(907L, "2026-06-17T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(908L, "2026-06-24T11:00:00Z", AttendanceStatusEnum.ABSENT)),
                "https://drive.google.com/drive/folders/mock-writing-cohort-1");
    }

    private StudyMeetingAttendance completedAttendance(Long meetingId, String scheduledAt, AttendanceStatusEnum status) {
        Instant scheduled = Instant.parse(scheduledAt);
        return new StudyMeetingAttendance(meetingId, scheduled, scheduled, scheduled.plusSeconds(5400), status);
    }
}
