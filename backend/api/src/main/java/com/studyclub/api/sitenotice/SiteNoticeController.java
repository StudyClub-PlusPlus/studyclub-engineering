package com.studyclub.api.sitenotice;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사용자 사이트의 사이트 공지 읽기 — 비로그인 포함 누구나 (specs/site-notice/spec.md). 콘솔은 {@link
 * AdminSiteNoticeController} 를 쓴다 — 관객이 다른 경로는 섞지 않는다.
 */
@Tag(name = "사이트 공지", description = "캡틴이 올린 사이트 전체 공지를 읽는다")
@RestController
@RequestMapping("/api/notices")
public class SiteNoticeController {

    private final SiteNoticeService siteNoticeService;

    public SiteNoticeController(SiteNoticeService siteNoticeService) {
        this.siteNoticeService = siteNoticeService;
    }

    @Operation(
            summary = "공지 목록 조회",
            description = "삭제되지 않은 공지를 최신순(ID 내림차순)으로. 제목과 게시일만 — 본문·작성자는 주지 않는다.")
    @GetMapping
    public SiteNoticeListResponse list(
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "10") int limit) {
        return siteNoticeService.getNotices(offset, limit);
    }

    @Operation(
            summary = "공지 상세 조회",
            description =
                    "공지 한 건과 이웃 두 건의 제목. newer 가 더 최신(「다음 공지」), older 가 더 오래된 공지(「이전 공지」)."
                            + " 없는 ID 와 삭제된 공지는 둘 다 404.")
    @GetMapping("/{noticeId}")
    public SiteNoticeDetailResponse detail(@PathVariable Long noticeId) {
        return siteNoticeService.getNotice(noticeId);
    }
}
