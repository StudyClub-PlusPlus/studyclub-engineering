package com.studyclub.api.bookmark;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.bookmark.StudyBookmark;
import com.studyclub.domain.bookmark.StudyBookmarkRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class StudyBookmarkService {

    private final StudyBookmarkRepository studyBookmarkRepository;
    private final StudyRepository studyRepository;

    public StudyBookmarkService(
            StudyBookmarkRepository studyBookmarkRepository, StudyRepository studyRepository) {
        this.studyBookmarkRepository = studyBookmarkRepository;
        this.studyRepository = studyRepository;
    }

    public Result getStudyBookmarks(Long accountId, int offset, int limit) {
        List<StudyBookmarkResponse.StudyBookmarkItem> items =
                studyBookmarkRepository.findBookmarkItems(accountId, offset, limit).stream()
                        .map(StudyBookmarkResponse.StudyBookmarkItem::from)
                        .toList();
        long total = studyBookmarkRepository.countByAccountId(accountId);
        return new Result(new StudyBookmarkResponse(items, total, offset, limit), HttpStatus.OK);
    }

    /** 담기. 이미 담겨 있어도 성공 — 두 기기에서 동시에 눌러도 한 줄만 남는다(UNIQUE). 공개 전(DRAFT)·없는 스터디는 404. */
    public void addBookmark(Long accountId, Long studyId) {
        studyRepository
                .findById(studyId)
                .filter(study -> study.getStatus() != StudyStatus.DRAFT)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));
        if (studyBookmarkRepository.existsByAccountIdAndStudyId(accountId, studyId)) {
            return;
        }
        try {
            studyBookmarkRepository.saveAndFlush(StudyBookmark.of(accountId, studyId));
        } catch (DataIntegrityViolationException alreadySaved) {
            // 동시에 들어온 다른 요청이 먼저 넣었다 — 결과는 같다
        }
    }

    /** 빼기. 본인 줄만 지운다. 없어도 성공. */
    public void removeBookmark(Long accountId, Long studyId) {
        studyBookmarkRepository.deleteByAccountIdAndStudyId(accountId, studyId);
    }

    public record Result(StudyBookmarkResponse response, HttpStatus httpStatus) {}
}
