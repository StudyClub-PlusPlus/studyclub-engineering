package com.studyclub.api.sitenotice;

import com.studyclub.api.auth.security.RequireAdmin;
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

/** 백오피스의 사이트 공지 — 목록·한 건·등록·수정·삭제. 캡틴만 ({@code @RequireAdmin}). */
@Tag(name = "백오피스 사이트 공지", description = "캡틴이 사이트 전체 공지를 올리고 고치고 내린다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/notices")
public class AdminSiteNoticeController {

    private final AdminSiteNoticeService adminSiteNoticeService;

    public AdminSiteNoticeController(AdminSiteNoticeService adminSiteNoticeService) {
        this.adminSiteNoticeService = adminSiteNoticeService;
    }

    @Operation(
            summary = "공지 목록 조회 (백오피스)",
            description =
                    "캡틴만 호출 가능. 삭제되지 않은 공지 전부 — 작성자·마지막 수정 포함, 본문 없음. q 는 제목 부분 일치(대소문자 무시),"
                            + " sort 는 publishedAt·title·updatedAt, order 는 asc·desc. 같은 값은 ID 내림차순.")
    @GetMapping
    public AdminSiteNoticeListResponse list(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "publishedAt") String sort,
            @RequestParam(defaultValue = "desc") String order,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        return adminSiteNoticeService.getNotices(q, sort, order, offset, limit);
    }

    @Operation(summary = "공지 한 건 조회 (백오피스)", description = "캡틴만 호출 가능. 편집 팝업을 채울 본문 포함 한 건.")
    @GetMapping("/{noticeId}")
    public AdminSiteNoticeDetailResponse detail(@PathVariable Long noticeId) {
        return adminSiteNoticeService.getNotice(noticeId);
    }

    @Operation(
            summary = "공지 등록",
            description = "캡틴만 호출 가능. 작성자는 토큰의 계정. 응답이 돌아온 순간 사이트 목록 맨 위에 있다.")
    @PostMapping
    public ResponseEntity<Void> create(
            @Valid @RequestBody SiteNoticeRequest request, Authentication authentication) {
        Long noticeId =
                adminSiteNoticeService.create((Long) authentication.getPrincipal(), request);
        return ResponseEntity.created(URI.create("/api/admin/notices/" + noticeId)).build();
    }

    @Operation(summary = "공지 수정", description = "캡틴만 호출 가능. 제목·본문 둘 다 필수. 작성자는 바뀌지 않는다.")
    @PatchMapping("/{noticeId}")
    public ResponseEntity<Void> update(
            @PathVariable Long noticeId, @Valid @RequestBody SiteNoticeRequest request) {
        adminSiteNoticeService.update(noticeId, request);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "공지 삭제",
            description = "캡틴만 호출 가능. 소프트 삭제 — 행은 남고 어디에도 안 보인다. 두 번째 호출은 404.")
    @DeleteMapping("/{noticeId}")
    public ResponseEntity<Void> delete(@PathVariable Long noticeId) {
        adminSiteNoticeService.remove(noticeId);
        return ResponseEntity.noContent().build();
    }
}
