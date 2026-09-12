package com.studyclub.api.bookmark;

import com.studyclub.domain.bookmark.StudyBookmarkRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class StudyBookmarkService {

    private final StudyBookmarkRepository studyBookmarkRepository;

    public StudyBookmarkService(StudyBookmarkRepository studyBookmarkRepository) {
        this.studyBookmarkRepository = studyBookmarkRepository;
    }

    public Result getStudyBookmarks(Long accountId, int offset, int limit) {
        List<StudyBookmarkResponse.StudyBookmarkItem> items =
                studyBookmarkRepository.findBookmarkItems(accountId, offset, limit).stream()
                        .map(StudyBookmarkResponse.StudyBookmarkItem::from)
                        .toList();
        long total = studyBookmarkRepository.countByAccountId(accountId);
        return new Result(new StudyBookmarkResponse(items, total, offset, limit), HttpStatus.OK);
    }

    public record Result(StudyBookmarkResponse response, HttpStatus httpStatus) {}
}
