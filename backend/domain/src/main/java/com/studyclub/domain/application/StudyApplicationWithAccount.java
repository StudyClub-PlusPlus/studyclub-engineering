package com.studyclub.domain.application;

import java.time.Instant;

public record StudyApplicationWithAccount(
        Long id,
        Long recruitmentId,
        Long accountId,
        String nickname,
        String email,
        String formAnswer,
        Instant createdAt) {}
