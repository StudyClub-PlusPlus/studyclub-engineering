package com.studyclub.api.bookmark;

import com.studyclub.domain.bookmark.StudyBookmarkSummary;
import java.util.List;

public record StudyBookmarkResponse(
        List<StudyBookmarkItem> items, long total, int offset, int limit) {

    public record StudyBookmarkItem(Long studyId, String title, String category) {
        public static StudyBookmarkItem from(StudyBookmarkSummary summary) {
            return new StudyBookmarkItem(
                    summary.getStudyId(), summary.getTitle(), summary.getCategory());
        }
    }
}
