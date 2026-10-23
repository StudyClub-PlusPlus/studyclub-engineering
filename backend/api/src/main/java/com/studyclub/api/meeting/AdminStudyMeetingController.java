package com.studyclub.api.meeting;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 백오피스 일정 탭의 회차 — 캡틴만 ({@code @RequireAdmin}). specs/study-meeting/spec.md 「반 회차 목록 (백오피스)」 */
@Tag(name = "백오피스 회차", description = "캡틴이 반의 회차를 본다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/studies/{studyId}/groups/{groupId}/meetings")
public class AdminStudyMeetingController {

    private final StudyMeetingService studyMeetingService;

    public AdminStudyMeetingController(StudyMeetingService studyMeetingService) {
        this.studyMeetingService = studyMeetingService;
    }

    @Operation(
            summary = "반 회차 목록",
            description =
                    "ADMIN만 호출 가능. 어느 스터디의 반이든 본다. 사이트 회차 목록과 같은 응답 — 킥오프(type=KICKOFF, number=0) · 제목 · 발표자 포함.")
    @GetMapping
    public StudyMeetingListResponse list(@PathVariable Long studyId, @PathVariable Long groupId) {
        return studyMeetingService.adminList(studyId, groupId);
    }
}
