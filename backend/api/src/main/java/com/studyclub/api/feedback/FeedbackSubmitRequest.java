package com.studyclub.api.feedback;

import com.studyclub.domain.feedback.FeedbackType;
import java.util.List;

/**
 * 문의 제출 본문. 길이는 앞뒤 공백을 자른 뒤에 재야 해서 {@code @Size} 대신 {@link FeedbackService} 가 검증한다. {@code type} 의
 * 모르는 값은 역직렬화에서 400 이다.
 *
 * @param imageFileIds {@code POST /api/uploads/images?purpose=FEEDBACK} 로 받은 번호. 없으면 첨부 없음
 * @param viewport 제출 때 화면 크기. 화면이 안 보내도 된다
 */
public record FeedbackSubmitRequest(
        FeedbackType type,
        String title,
        String content,
        List<Long> imageFileIds,
        Viewport viewport) {

    public record Viewport(Integer width, Integer height) {}
}
