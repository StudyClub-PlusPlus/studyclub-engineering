package com.studyclub.api.study;

import com.studyclub.api.auth.security.RequireAdmin;
import com.studyclub.api.discord.StudyDiscordLinkService;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
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

/**
 * 백오피스의 스터디 — 목록·상세·등록·수정·삭제. 캡틴만 ({@code @RequireAdmin}).
 *
 * <p>사용자 사이트는 {@link StudyController}({@code /api/studies})를 쓴다. 로직은 {@link StudyService} 를 같이 쓴다 —
 * specs/study/spec.md 「관객별 엔드포인트」 · specs/authz-guards/spec.md
 */
@Tag(name = "백오피스 스터디", description = "캡틴이 스터디를 조회·등록·수정·삭제한다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/studies")
public class AdminStudyController {

    private final BackofficeStudyListService backofficeStudyListService;
    private final StudyService studyService;
    private final StudyDiscordLinkService studyDiscordLinkService;

    public AdminStudyController(
            BackofficeStudyListService backofficeStudyListService,
            StudyService studyService,
            StudyDiscordLinkService studyDiscordLinkService) {
        this.backofficeStudyListService = backofficeStudyListService;
        this.studyService = studyService;
        this.studyDiscordLinkService = studyDiscordLinkService;
    }

    @Operation(summary = "백오피스 스터디 목록 조회", description = "ADMIN만 호출 가능. DRAFT 포함 전 상태를 반환한다.")
    @GetMapping
    public BackofficeStudyListResponse list(
            @RequestParam(required = false) StudyCategory category,
            @RequestParam(required = false) StudyKind studyKind,
            @RequestParam(required = false) StudyStatus status,
            @RequestParam(required = false) Long studyId,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        return backofficeStudyListService.getStudies(
                new BackofficeStudyListFilter(category, studyKind, status, studyId), offset, limit);
    }

    @Operation(summary = "백오피스 스터디 상세 조회", description = "ADMIN만 호출 가능. DRAFT 도 조회된다.")
    @GetMapping("/{studyId}")
    public StudyDetailResponse detail(@PathVariable Long studyId) {
        return studyService.getDetailForBackOffice(studyId);
    }

    @Operation(
            summary = "스터디 등록",
            description =
                    "ADMIN만 호출 가능. 등록 후 STATUS=DRAFT 로 비공개. 디스코드 봇이 설정돼 있으면 등록 뒤"
                            + " 디스코드 스터디를 만들어 연결한다 (실패해도 201).")
    @PostMapping
    public ResponseEntity<Void> create(
            @Valid @RequestBody StudyCreateRequest request, Authentication authentication) {
        Long accountId = (Long) authentication.getPrincipal();
        Long studyId = studyService.create(accountId, request);
        // 등록 트랜잭션이 커밋된 뒤에 봇을 부른다. 실패해도 등록은 성공이다 (specs/discord-study-link/spec.md)
        studyDiscordLinkService.linkAfterCreate(accountId, studyId);
        return ResponseEntity.created(URI.create("/api/admin/studies/" + studyId)).build();
    }

    @Operation(
            summary = "스터디 수정 (백오피스)",
            description =
                    "ADMIN만 호출 가능 — 네비게이터는 PATCH /api/studies/{studyId} 를 쓴다 (POL-0001)."
                            + " 보낸 필드만 반영한다.")
    @PatchMapping("/{studyId}")
    public ResponseEntity<Void> update(
            @PathVariable Long studyId, @Valid @RequestBody StudyUpdateRequest request) {
        studyService.updateFromBackOffice(studyId, request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "스터디 삭제", description = "ADMIN만 호출 가능. 크루 명단·출석 기록 포함 영구 삭제.")
    @DeleteMapping("/{studyId}")
    public ResponseEntity<Void> delete(@PathVariable Long studyId) {
        studyService.delete(studyId);
        return ResponseEntity.noContent().build();
    }
}
