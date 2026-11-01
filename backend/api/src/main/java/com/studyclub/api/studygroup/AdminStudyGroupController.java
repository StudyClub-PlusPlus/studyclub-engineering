package com.studyclub.api.studygroup;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 백오피스 신청자 탭의 반 — 캡틴만 ({@code @RequireAdmin}). specs/study-group/spec.md */
@Tag(name = "백오피스 반", description = "캡틴이 스터디의 반을 만든다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/studies/{studyId}/groups")
public class AdminStudyGroupController {

    private final AdminStudyGroupService adminStudyGroupService;

    public AdminStudyGroupController(AdminStudyGroupService adminStudyGroupService) {
        this.adminStudyGroupService = adminStudyGroupService;
    }

    @Operation(
            summary = "반 만들기",
            description = "ADMIN만 호출 가능. 제목만 받는다 (1~20자). 스터디 시간·회차는 만들지 않는다. 같은 이름이면 409.")
    @PostMapping
    public ResponseEntity<StudyGroupCreateResponse> create(
            @PathVariable Long studyId, @Valid @RequestBody StudyGroupCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminStudyGroupService.create(studyId, request));
    }

    @Operation(
            summary = "반 삭제",
            description = "ADMIN만 호출 가능. 활성·수료·참여 중단 크루가 있으면 409 GROUP_NOT_EMPTY. 회차·출석도 함께 지운다.")
    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> delete(@PathVariable Long studyId, @PathVariable Long groupId) {
        adminStudyGroupService.delete(studyId, groupId);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "반 수정",
            description =
                    "ADMIN만 호출 가능. 보낸 필드만 반영한다."
                            + " name: 1~20자, 같은 스터디에 같은 이름이면 409."
                            + " daysOfWeek: mon~sun 소문자, 1개 이상, null 이면 미정으로 되돌린다."
                            + " startTime: HH:mm(분반 현지), null 이면 미정으로 되돌린다."
                            + " timezone 없이 startTime 만 보내면 400."
                            + " timezone: POL-0006 허용 값(Asia/Seoul · America/New_York · America/Vancouver"
                            + " · America/Los_Angeles), null 이면 미정(startTime 도 함께 지운다)으로 되돌린다.")
    @PatchMapping("/{groupId}")
    public StudyGroupUpdateResponse update(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @Valid @RequestBody StudyGroupUpdateRequest request) {
        return adminStudyGroupService.update(studyId, groupId, request);
    }

    @Operation(
            summary = "킥오프 정하기",
            description =
                    "ADMIN만 호출 가능. 반의 킥오프(0회차)를 만들거나 일자를 옮긴다. 1회차보다 앞, 다른 회차와 다른 날이어야 한다(400 · 409"
                            + " MEETING_DATE_CONFLICT). 지난 시각도 받는다.")
    @PutMapping("/{groupId}/kickoff")
    public ResponseEntity<Void> setKickoff(
            @PathVariable Long studyId,
            @PathVariable Long groupId,
            @Valid @RequestBody StudyGroupKickoffRequest request) {
        adminStudyGroupService.setKickoff(studyId, groupId, request.scheduledAt());
        return ResponseEntity.noContent().build();
    }
}
