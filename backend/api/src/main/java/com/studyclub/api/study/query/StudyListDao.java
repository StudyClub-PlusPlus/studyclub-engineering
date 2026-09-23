package com.studyclub.api.study.query;

import com.studyclub.domain.study.Study;
import java.util.List;

/**
 * 공개 스터디 목록 조회. 스터디·모집 회차·참여자 세 애그리거트를 함께 읽는 <b>화면용 조회</b>라 애그리거트 리포지토리({@code StudyRepository})에
 * 두지 않는다 — docs/backend-development-guide/query-placement-guide.md
 *
 * <p>쓰는 메서드만 둔다. 필터·정렬·페이징은 DB 에서 한다 (페이지네이션이 있어 메모리에서 자르면 {@code total} 과 페이지가 어긋난다).
 */
public interface StudyListDao {

    List<Study> search(StudyListFilter filter, int offset, int limit);

    long count(StudyListFilter filter);
}
