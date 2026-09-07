package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubDtos.ApplicationSummary;
import com.studyclub.api.participant.ParticipantHubDtos.AttendanceItem;
import com.studyclub.api.participant.ParticipantHubDtos.BookmarkSummary;
import com.studyclub.api.participant.ParticipantHubDtos.HubResponse;
import com.studyclub.api.participant.ParticipantHubDtos.StudyDetail;
import com.studyclub.api.participant.ParticipantHubDtos.StudySummary;
import com.studyclub.api.participant.ParticipantHubDtos.UpcomingMeeting;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.application.ApplicationStatusEnum;
import com.studyclub.domain.attendance.AttendanceStatusEnum;
import com.studyclub.domain.participant.ParticipantStatusEnum;
import com.studyclub.domain.study.StudyCohortStatusEnum;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ParticipantHubService {

    public HubResponse getHub(String accountEmail) {
        return new HubResponse(
                List.of(
                        new StudySummary(301L, 101L, "AI 논문 읽기", ParticipantStatusEnum.ACTIVE, 100,
                                Instant.parse("2026-09-08T11:00:00Z"), null),
                        new StudySummary(302L, 102L, "Spring Boot 딥다이브", ParticipantStatusEnum.ACTIVE, null,
                                Instant.parse("2026-09-12T10:00:00Z"), null)),
                List.of(
                        new StudySummary(291L, 91L, "개발자 글쓰기", ParticipantStatusEnum.COMPLETED, 88,
                                null, null)),
                List.of(
                        new ApplicationSummary(501L, 303L, 103L, "오픈소스 첫 기여", ApplicationStatusEnum.PENDING,
                                Instant.parse("2026-09-05T04:30:00Z")),
                        new ApplicationSummary(502L, 304L, 104L, "데이터 시각화", ApplicationStatusEnum.REJECTED,
                                Instant.parse("2026-08-20T02:00:00Z"))),
                List.of(
                        new UpcomingMeeting(1004L, 301L, 101L, "AI 논문 읽기",
                                Instant.parse("2026-09-08T11:00:00Z")),
                        new UpcomingMeeting(1101L, 302L, 102L, "Spring Boot 딥다이브",
                                Instant.parse("2026-09-12T10:00:00Z"))),
                List.of(
                        new BookmarkSummary(701L, 105L, "UX 리서치 북클럽", null)));
    }

    public StudyDetail getStudy(String accountEmail, Long cohortId) {
        if (cohortId == 301L) {
            return ongoingStudy();
        }
        if (cohortId == 302L) {
            return upcomingStudy();
        }
        if (cohortId == 291L) {
            return completedStudy();
        }
        if (cohortId == 303L || cohortId == 304L) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "참여 중인 스터디가 아닙니다.");
        }
        throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
    }

    private StudyDetail ongoingStudy() {
        return new StudyDetail(
                301L, 101L, "AI 논문 읽기", StudyCohortStatusEnum.OPEN, ParticipantStatusEnum.ACTIVE,
                "화요일반", "Asia/Seoul", "김○○",
                3, 12, 100, java.time.LocalDate.parse("2026-08-18"),
                new UpcomingMeeting(1004L, 301L, 101L, "AI 논문 읽기",
                        Instant.parse("2026-09-08T11:00:00Z")),
                List.of(
                        completedAttendance(1001L, "2026-08-18T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(1002L, "2026-08-25T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(1003L, "2026-09-01T11:00:00Z", AttendanceStatusEnum.LATE),
                        new AttendanceItem(1004L, Instant.parse("2026-09-08T11:00:00Z"), null, null, null)),
                "https://drive.google.com/drive/folders/mock-ai-paper-cohort-3");
    }

    private StudyDetail upcomingStudy() {
        return new StudyDetail(
                302L, 102L, "Spring Boot 딥다이브", StudyCohortStatusEnum.OPEN, ParticipantStatusEnum.ACTIVE,
                "토요일반", "Asia/Seoul", "박○○",
                0, 8, null, java.time.LocalDate.parse("2026-09-12"),
                new UpcomingMeeting(1101L, 302L, 102L, "Spring Boot 딥다이브",
                        Instant.parse("2026-09-12T10:00:00Z")),
                List.of(),
                "https://drive.google.com/drive/folders/mock-spring-boot-cohort-2");
    }

    private StudyDetail completedStudy() {
        return new StudyDetail(
                291L, 91L, "개발자 글쓰기", StudyCohortStatusEnum.CLOSED, ParticipantStatusEnum.COMPLETED,
                "수요일반", "Asia/Seoul", "이○○",
                8, 8, 88, java.time.LocalDate.parse("2026-05-06"), null,
                List.of(
                        completedAttendance(901L, "2026-05-06T11:00:00Z", AttendanceStatusEnum.PRESENT),
                        completedAttendance(902L, "2026-05-13T11:00:00Z", AttendanceStatusEnum.ABSENT)),
                "https://drive.google.com/drive/folders/mock-writing-cohort-1");
    }

    private AttendanceItem completedAttendance(Long meetingId, String scheduledAt, AttendanceStatusEnum status) {
        Instant scheduled = Instant.parse(scheduledAt);
        return new AttendanceItem(meetingId, scheduled, scheduled, scheduled.plusSeconds(5400), status);
    }
}
