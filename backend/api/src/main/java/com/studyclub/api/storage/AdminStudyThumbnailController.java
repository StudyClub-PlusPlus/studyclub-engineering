package com.studyclub.api.storage;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "백오피스 스터디 썸네일")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/study-thumbnails")
public class AdminStudyThumbnailController {
    private final StudyThumbnailUploadService uploadService;

    public AdminStudyThumbnailController(StudyThumbnailUploadService uploadService) {
        this.uploadService = uploadService;
    }

    @Operation(summary = "스터디 썸네일 업로드 URL 발급")
    @PostMapping("/upload-url")
    public StudyThumbnailUploadResponse createUploadUrl(
            @Valid @RequestBody StudyThumbnailUploadRequest request) {
        return uploadService.createUploadUrl(request);
    }
}
