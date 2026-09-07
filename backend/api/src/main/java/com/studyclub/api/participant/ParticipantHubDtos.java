package com.studyclub.api.participant;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ParticipantHubDtos {

    private ParticipantHubDtos() {
    }

    public record HubResponse(
            List<StudySummary> activeStudies,
            List<StudySummary> pastStudies,
            List<ApplicationSummary> applications,
            List<UpcomingMeeting> upcomingMeetings,
            List<BookmarkSummary> bookmarks) {
    }

    public record StudySummary(
            Long id,
            String title,
            String cohortName,
            String status,
            Integer attendanceRate,
            Instant nextMeetingAt,
            String thumbnailUrl) {
    }

    public record ApplicationSummary(
            Long id,
            Long studyId,
            String studyTitle,
            String cohortName,
            String status,
            Instant appliedAt) {
    }

    public record UpcomingMeeting(
            Long id,
            Long studyId,
            String studyTitle,
            int sessionNumber,
            Instant scheduledAt) {
    }

    public record BookmarkSummary(
            Long id,
            Long studyId,
            String studyTitle,
            String thumbnailUrl,
            LocalDate recruitDeadline) {
    }
}
