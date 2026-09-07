package com.studyclub.api.bookmark.dto;

public record StudyBookmarkDtos(
        String title,
        String status,
        String category,
        String studySchedule,
        String studyDuration
) {
}
