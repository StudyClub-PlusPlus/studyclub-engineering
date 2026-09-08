package com.studyclub.api.bookmark;

import java.util.List;

import com.studyclub.api.bookmark.dto.StudyBookmarkDtos;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class StudyBookmarkService {

    // TODO: replace mock data with real implementation
    public Result getBookmarks(Long accountId, int offset, int limit) {
        List<StudyBookmarkDtos> mockItems = List.of(
                new StudyBookmarkDtos("java study", "OPEN", "BACKEND", "every week", "8 weeks"),
                new StudyBookmarkDtos("DDIA", "CLOSED", "DATA", "once a week", "12 weeks")
        );
        return new Result(new StudyBookmarkResponse(mockItems, mockItems.size(), offset, limit), HttpStatus.OK);
    }

    public record Result(StudyBookmarkResponse response, HttpStatus httpStatus) {
    }
}
