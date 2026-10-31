package com.studyclub.domain.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FeedbackTest {

    private static final Long CAPTAIN = 7L;
    private static final Long OTHER_CAPTAIN = 8L;

    private static Feedback newFeedback() {
        return new Feedback(
                1L, FeedbackType.BUG, "버튼이 안 눌려요", "출석 버튼을 눌러도 반응이 없습니다.", null, null, null);
    }

    @Test
    @DisplayName("새 문의는 미확인이고, 제출자에게는 접수로 보인다")
    void startsAsNew() {
        Feedback feedback = newFeedback();

        assertThat(feedback.getStatus()).isEqualTo(FeedbackStatus.NEW);
        assertThat(feedback.submitterStatus()).isEqualTo(FeedbackSubmitterStatus.RECEIVED);
        assertThat(feedback.selectableStatuses())
                .containsExactly(FeedbackStatus.NEW, FeedbackStatus.SEEN);
    }

    @Test
    @DisplayName("회신 전에는 미확인 ↔ 확인만 오간다. 같은 값은 바꾸지 않는다")
    void changesBetweenNewAndSeen() {
        Feedback feedback = newFeedback();

        assertThat(feedback.changeStatus(FeedbackStatus.SEEN)).isTrue();
        assertThat(feedback.getStatus()).isEqualTo(FeedbackStatus.SEEN);
        assertThat(feedback.changeStatus(FeedbackStatus.SEEN)).isFalse();
        assertThat(feedback.changeStatus(FeedbackStatus.NEW)).isTrue();
        assertThat(feedback.submitterStatus()).isEqualTo(FeedbackSubmitterStatus.RECEIVED);
    }

    @Test
    @DisplayName("회신 없이 완료로 바꾸면 FEEDBACK_REPLY_REQUIRED")
    void cannotCompleteWithoutReply() {
        Feedback feedback = newFeedback();

        assertThatThrownBy(() -> feedback.changeStatus(FeedbackStatus.DONE))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.FEEDBACK_REPLY_REQUIRED);
        assertThat(feedback.getStatus()).isEqualTo(FeedbackStatus.NEW);
    }

    @Test
    @DisplayName("첫 회신이 완료로 바꾸고 보낸 캡틴을 완료 처리자로 남긴다")
    void firstReplyCompletes() {
        Feedback feedback = newFeedback();
        Instant at = Instant.parse("2026-10-26T01:00:00Z");

        boolean first = feedback.reply("디스코드 채널에 남겨 주세요.", CAPTAIN, at);

        assertThat(first).isTrue();
        assertThat(feedback.getStatus()).isEqualTo(FeedbackStatus.DONE);
        assertThat(feedback.getDoneByAccountId()).isEqualTo(CAPTAIN);
        assertThat(feedback.getRepliedAt()).isEqualTo(at);
        assertThat(feedback.submitterStatus()).isEqualTo(FeedbackSubmitterStatus.ANSWERED);
        assertThat(feedback.selectableStatuses()).isEmpty();
    }

    @Test
    @DisplayName("나노초 시각도 DB 정밀도에 맞춘다 — 첫 응답과 재조회가 같은 회신 시각을 반환한다")
    void firstReplyUsesDatabasePrecision() {
        Feedback feedback = newFeedback();

        feedback.reply("처음 보낸 회신입니다.", CAPTAIN, Instant.parse("2026-10-26T01:00:00.123456789Z"));

        assertThat(feedback.getRepliedAt()).isEqualTo(Instant.parse("2026-10-26T01:00:00.123456Z"));
    }

    @Test
    @DisplayName("회신을 고치면 내용만 바뀐다 — 시각 · 상태 · 처리자는 그대로")
    void editingReplyKeepsTimeAndOwner() {
        Feedback feedback = newFeedback();
        Instant first = Instant.parse("2026-10-26T01:00:00Z");
        feedback.reply("처음 보낸 회신입니다.", CAPTAIN, first);

        boolean firstAgain =
                feedback.reply("고친 회신입니다. 링크를 더했어요.", OTHER_CAPTAIN, first.plusSeconds(60));

        assertThat(firstAgain).isFalse();
        assertThat(feedback.getReplyContent()).isEqualTo("고친 회신입니다. 링크를 더했어요.");
        assertThat(feedback.getRepliedAt()).isEqualTo(first);
        assertThat(feedback.getDoneByAccountId()).isEqualTo(CAPTAIN);
        assertThat(feedback.getStatus()).isEqualTo(FeedbackStatus.DONE);
    }

    @Test
    @DisplayName("회신한 문의는 상태를 바꾸지 못한다 — 같은 값(완료)은 그대로 둔다")
    void answeredStatusIsLocked() {
        Feedback feedback = newFeedback();
        feedback.reply("처음 보낸 회신입니다.", CAPTAIN, Instant.now());

        assertThat(feedback.changeStatus(FeedbackStatus.DONE)).isFalse();
        assertThatThrownBy(() -> feedback.changeStatus(FeedbackStatus.SEEN))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.FEEDBACK_ALREADY_ANSWERED);
        assertThat(feedback.getStatus()).isEqualTo(FeedbackStatus.DONE);
    }

    @Test
    @DisplayName("메모는 빈 문자열이면 지운다")
    void blankMemoClears() {
        Feedback feedback = newFeedback();

        feedback.changeAdminMemo("이스케이프 누락 의심");
        assertThat(feedback.getAdminMemo()).isEqualTo("이스케이프 누락 의심");
        feedback.changeAdminMemo("");
        assertThat(feedback.getAdminMemo()).isNull();
    }
}
