package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubDtos.ApplicationSummary;
import com.studyclub.api.participant.ParticipantHubDtos.AttendanceItem;
import com.studyclub.api.participant.ParticipantHubDtos.BookmarkSummary;
import com.studyclub.api.participant.ParticipantHubDtos.HubResponse;
import com.studyclub.api.participant.ParticipantHubDtos.LeaveRequest;
import com.studyclub.api.participant.ParticipantHubDtos.ResourceItem;
import com.studyclub.api.participant.ParticipantHubDtos.StudyDetail;
import com.studyclub.api.participant.ParticipantHubDtos.StudySummary;
import com.studyclub.api.participant.ParticipantHubDtos.UpcomingMeeting;
import com.studyclub.api.participant.ParticipantHubDtos.WeeklyTask;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ParticipantHubService {

    public HubResponse getHub(String accountEmail) {
        return new HubResponse(
                List.of(
                        new StudySummary(101L, "AI 논문 읽기", "3기", "ONGOING", 100,
                                Instant.parse("2026-09-08T11:00:00Z"), null),
                        new StudySummary(102L, "Spring Boot 딥다이브", "2기", "UPCOMING", null,
                                Instant.parse("2026-09-12T10:00:00Z"), null)),
                List.of(
                        new StudySummary(91L, "개발자 글쓰기", "1기", "COMPLETED", 88,
                                null, null)),
                List.of(
                        new ApplicationSummary(501L, 103L, "오픈소스 첫 기여", "1기", "PENDING",
                                Instant.parse("2026-09-05T04:30:00Z")),
                        new ApplicationSummary(502L, 104L, "데이터 시각화", "2기", "REJECTED",
                                Instant.parse("2026-08-20T02:00:00Z"))),
                List.of(
                        new UpcomingMeeting(1004L, 101L, "AI 논문 읽기", 4,
                                Instant.parse("2026-09-08T11:00:00Z")),
                        new UpcomingMeeting(1101L, 102L, "Spring Boot 딥다이브", 1,
                                Instant.parse("2026-09-12T10:00:00Z"))),
                List.of(
                        new BookmarkSummary(701L, 105L, "UX 리서치 북클럽", null,
                                LocalDate.parse("2026-09-18"))));
    }

    public StudyDetail getStudy(String accountEmail, Long studyId) {
        if (studyId == 101L) {
            return ongoingStudy();
        }
        if (studyId == 102L) {
            return upcomingStudy();
        }
        if (studyId == 91L) {
            return completedStudy();
        }
        if (studyId == 103L || studyId == 104L || studyId == 105L) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "참여 중인 스터디가 아닙니다.");
        }
        throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
    }

    private StudyDetail ongoingStudy() {
        return new StudyDetail(
                101L, "AI 논문 읽기", "3기", "ONGOING", "화요일반", "Asia/Seoul", "김○○",
                3, 12, 100, LocalDate.parse("2026-08-18"),
                new UpcomingMeeting(1004L, 101L, "AI 논문 읽기", 4,
                        Instant.parse("2026-09-08T11:00:00Z")),
                List.of(
                        new AttendanceItem(1001L, 1, Instant.parse("2026-08-18T11:00:00Z"), "PRESENT"),
                        new AttendanceItem(1002L, 2, Instant.parse("2026-08-25T11:00:00Z"), "PRESENT"),
                        new AttendanceItem(1003L, 3, Instant.parse("2026-09-01T11:00:00Z"), "LATE"),
                        new AttendanceItem(1004L, 4, Instant.parse("2026-09-08T11:00:00Z"), "SCHEDULED")),
                new LeaveRequest(801L, 1004L, Instant.parse("2026-09-08T11:00:00Z"), "PENDING"),
                List.of(new WeeklyTask(901L, "4주차 논문 읽기", Instant.parse("2026-09-08T10:00:00Z"),
                        "TODO", "https://example.com/submissions/901")),
                List.of(new ResourceItem(951L, "4주차 발제 자료", "MATERIAL",
                        "https://example.com/resources/951", Instant.parse("2026-09-06T01:00:00Z"))));
    }

    private StudyDetail upcomingStudy() {
        return new StudyDetail(
                102L, "Spring Boot 딥다이브", "2기", "UPCOMING", "토요일반", "Asia/Seoul", "박○○",
                0, 8, null, LocalDate.parse("2026-09-12"),
                new UpcomingMeeting(1101L, 102L, "Spring Boot 딥다이브", 1,
                        Instant.parse("2026-09-12T10:00:00Z")),
                List.of(), null, List.of(),
                List.of(new ResourceItem(952L, "시작 전 안내", "NOTICE",
                        "https://example.com/notices/952", Instant.parse("2026-09-04T02:00:00Z"))));
    }

    private StudyDetail completedStudy() {
        return new StudyDetail(
                91L, "개발자 글쓰기", "1기", "COMPLETED", "수요일반", "Asia/Seoul", "이○○",
                8, 8, 88, LocalDate.parse("2026-05-06"), null,
                List.of(
                        new AttendanceItem(901L, 1, Instant.parse("2026-05-06T11:00:00Z"), "PRESENT"),
                        new AttendanceItem(902L, 2, Instant.parse("2026-05-13T11:00:00Z"), "ABSENT")),
                null, List.of(), List.of());
    }
}
