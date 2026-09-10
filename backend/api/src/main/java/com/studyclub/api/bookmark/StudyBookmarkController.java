package com.studyclub.api.bookmark;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "북마크", description = "스터디 북마크 조회")
@RestController
@RequestMapping("/api/me")
public class StudyBookmarkController {

    private final StudyBookmarkService studyBookmarkService;

    public StudyBookmarkController(StudyBookmarkService studyBookmarkService) {
        this.studyBookmarkService = studyBookmarkService;
    }

    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/bookmarks")
    public ResponseEntity<StudyBookmarkResponse> getBookmarks(
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit,
            Authentication authentication) {

        if (offset < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "offset 은 0 이상이어야 합니다.");
        }
        // TODO: come back later with the agreed max value on limit
        if (limit <= 0 || limit > 100) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "limit 은 1 이상 100 이하여야 합니다.");
        }

        Long accountId = Long.valueOf((String) authentication.getDetails());
        StudyBookmarkService.Result result =
                studyBookmarkService.getBookmarks(accountId, offset, limit);
        return ResponseEntity.status(result.httpStatus()).body(result.response());
    }
}
