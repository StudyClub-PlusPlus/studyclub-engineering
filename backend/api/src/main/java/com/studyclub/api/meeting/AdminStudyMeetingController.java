package com.studyclub.api.meeting;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 백오피스 일정 탭의 회차 · 규칙 — 캡틴(관리자, {@code SYSTEM_ROLE = ADMIN})만 ({@code @RequireAdmin}).
 * specs/study-meeting/spec.md 「반 회차 목록 (백오피스)」 · 「백오피스 회차 쓰기 · 규칙」. 쓰기는 사이트 API 와 같은 서비스 코드를 타고 권한만
 * 다르다 — 담당 캡틴이 아니어도 캡틴이면 어느 스터디의 어느 반이든.
 */
@Tag(name = "백오피스 회차", description = "캡틴이 반의 회차를 보고 고친다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/studies/{studyId}/groups/{groupId}")
public class AdminStudyMeetingController {

    private final StudyMeetingService studyMeetingService;

    public AdminStudyMeetingController(StudyMeetingService studyMeetingService) {
        this.studyMeetingService = studyMeetingService;
    }

    @Operation(
            summary = "반 회차 목록",
            description =
                    "ADMIN만 호출 가능. 어느 스터디의 반이든 본다. 사이트 회차 목록과 같은 응답 — 킥오프(type=KICKOFF, number=0) · 제목 · 발표자 포함.")
    @GetMapping("/meetings")
    public StudyMeetingListResponse list(@PathVariable Long studyId, @PathVariable Long groupId) {
        return studyMeetingService.adminList(studyId, groupId);
    }

    @Operation(
            summary = "회차 추가",
            description = "ADMIN만 호출 가능. 한 번 · 반복(날짜 목록, UTC). 사이트 회차 추가와 같은 규칙 — 킥오프는 만들지 않는다.")
    @PostMapping("/meetings")
    public ResponseEntity<Void> create(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @Valid @RequestBody StudyMeetingRequests.AdminCreate request) {
        studyMeetingService.adminCreate(studyId, groupId, request);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "회차 수정",
            description = "ADMIN만 호출 가능. 시작 전 회차의 시각 · 제목 · 발표자. 발표자는 보낸 칸만 바꾼다. 킥오프는 「킥오프 정하기」로.")
    @PutMapping("/meetings/{meetingId}")
    public ResponseEntity<Void> update(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @PathVariable Long meetingId,
            @Valid @RequestBody StudyMeetingRequests.Update request) {
        studyMeetingService.adminUpdate(studyId, groupId, meetingId, request);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "회차 일괄 삭제",
            description = "ADMIN만 호출 가능. 그 반의 시작 전 회차 여럿. 하나라도 시작했거나 킥오프면 아무것도 지우지 않는다(409).")
    @DeleteMapping("/meetings")
    public ResponseEntity<Void> deleteAll(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @Valid @RequestBody StudyMeetingRequests.AdminBulkDelete request) {
        studyMeetingService.adminDeleteAll(studyId, groupId, request.meetingIds());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "스터디 규칙 저장", description = "ADMIN만 호출 가능. 500자까지, null · 공백이면 지운다.")
    @PutMapping("/rules")
    public ResponseEntity<Void> saveRules(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @RequestBody StudyMeetingRequests.Rules request) {
        studyMeetingService.adminSaveRules(studyId, groupId, request.rules());
        return ResponseEntity.noContent().build();
    }
}
