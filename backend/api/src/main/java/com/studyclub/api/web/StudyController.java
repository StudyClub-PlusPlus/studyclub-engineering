package com.studyclub.api.web;

import com.studyclub.api.study.StudyListResponse;
import com.studyclub.api.study.StudyListService;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Instant;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "스터디", description = "스터디 목록·상세")
@RestController
@RequestMapping("/api/studies")
public class StudyController {

    private final StudyListService studyListService;
    private final StudyService studyService;

    public StudyController(StudyListService studyListService, StudyService studyService) {
        this.studyListService = studyListService;
        this.studyService = studyService;
    }

    @Operation(summary = "스터디 목록 조회", description = "카테고리·모집 상태·키워드·모집 마감일 필터로 스터디 목록을 조회한다.")
    @GetMapping
    public StudyListResponse list(
            @RequestParam(required = false) StudyCategory category,
            @RequestParam(required = false) StudyStatus status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Instant recruitDeadlineBefore,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {

        return studyListService.list(
                category, status, keyword, recruitDeadlineBefore, offset, limit);
    }

    @GetMapping("/{studyId}")
    public StudyDetailResponse detail(@PathVariable Long studyId) {
        return studyService.getDetail(studyId);
    }

    @Operation(summary = "스터디 등록", description = "ADMIN 만 호출 가능. 등록 후 STATUS=DRAFT 로 비공개.")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ResponseEntity<Void> create(
            @Valid @RequestBody StudyCreateRequest request, Authentication authentication) {
        Long accountId = (Long) authentication.getPrincipal();
        Long studyId = studyService.create(accountId, request);
        return ResponseEntity.created(URI.create("/api/studies/" + studyId)).build();
    }

    @Operation(summary = "스터디 수정", description = "ADMIN 또는 해당 스터디 LEADER/CO_LEADER 만 호출 가능.")
    @SecurityRequirement(name = "bearerAuth")
    @PatchMapping("/{studyId}")
    public ResponseEntity<Void> update(
            @PathVariable Long studyId,
            @Valid @RequestBody StudyUpdateRequest request,
            Authentication authentication) {
        Long accountId = (Long) authentication.getPrincipal();
        studyService.update(accountId, studyId, request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "스터디 삭제", description = "ADMIN 만 호출 가능. 크루 명단·출석 기록 포함 영구 삭제.")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{studyId}")
    public ResponseEntity<Void> delete(@PathVariable Long studyId, Authentication authentication) {
        Long accountId = (Long) authentication.getPrincipal();
        studyService.delete(accountId, studyId);
        return ResponseEntity.noContent().build();
    }
}
