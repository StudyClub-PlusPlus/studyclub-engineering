package com.studyclub.api.web;

import com.studyclub.domain.study.StudyCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record StudyCreateRequest(
        Long studyProgramId,
        @NotBlank @Size(max = 60) String title,
        @NotBlank String oneLineSummary,
        String description,
        @NotNull StudyCategory category,
        String thumbnailUrl,
        Instant recruitDeadline,
        String schedule) {}
