package com.studyclub.api.storage;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record StudyThumbnailUploadRequest(
        @NotBlank String filename,
        @NotBlank String contentType,
        @NotNull @Max(value = 5 * 1024 * 1024, message = "파일은 5MB 이하여야 합니다.") Long size) {}
