package com.studyclub.api.study;

import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * 스터디 등록 요청.
 *
 * <p>프로그램은 따로 등록하지 않는다 — 기수 없는 프로그램은 의미가 없다(docs/erd/STUDY_PROGRAM.md). 그래서 이 요청 하나가 두 경우를 다 맡는다:
 *
 * <ul>
 *   <li><b>새 프로그램</b> — {@code studyProgramId} 를 비우고 {@code studyKind} 로 종류를 정한다. 프로그램과 첫 기수가 한 번에
 *       만들어진다
 *   <li><b>기존 클럽의 새 기수</b> — {@code studyProgramId} 로 붙인다. 그 프로그램은 {@code CLUB} 이어야 한다 (스터디는 기수가
 *       1개다)
 * </ul>
 *
 * <p>둘을 함께 보내면 400 이다 — specs/study/spec.md AC-6 · AC-7.
 */
public record StudyCreateRequest(
        Long studyProgramId,
        StudyKind studyKind,
        @NotBlank @Size(max = 60) String title,
        @NotBlank @Size(max = 255) String oneLineSummary,
        String description,
        @NotNull StudyCategory category,
        String thumbnailUrl,
        Instant recruitDeadline,
        String schedule) {}
