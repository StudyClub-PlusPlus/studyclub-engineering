package com.studyclub.api.participant;

import com.studyclub.api.participant.ParticipantHubDtos.ApplicationSummary;
import com.studyclub.api.participant.ParticipantHubDtos.BookmarkSummary;
import com.studyclub.api.participant.ParticipantHubDtos.HubResponse;
import com.studyclub.api.participant.ParticipantHubDtos.StudySummary;
import com.studyclub.api.participant.ParticipantHubDtos.UpcomingMeeting;
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
}
