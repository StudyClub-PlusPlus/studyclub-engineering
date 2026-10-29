package com.studyclub.notification;

import com.studyclub.domain.notice.StudyNoticeSent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 반 공지를 보내면 받는 사람마다 메일 {@code NOTIFICATION} 행을 만든다 (specs/study-notice/spec.md).
 *
 * <p><b>{@code BEFORE_COMMIT}</b> — 다른 알림 구독자({@link UserRegisteredNotificationListener})와 달리 공지를
 * 저장하는 트랜잭션 안에서 행을 만든다. 메일은 잃으면 안 되는데 {@code AFTER_COMMIT} 에서 만들면 커밋과 행 생성 사이에 프로세스가 죽을 때 「공지는
 * 저장됐는데 메일 행이 없는」 상태가 생긴다. 그래서 예외도 <b>삼키지 않는다</b> — 템플릿이 없거나 행 저장이 실패하면 공지 전체가 롤백된다. 실제 발송(SES 호출)은
 * 커밋 뒤 폴러가 하므로 요청 트랜잭션에 외부 호출이 들어가지 않는다 (specs/domain-events/spec.md 「발행·전달 규칙」).
 */
@Component
@RequiredArgsConstructor
public class StudyNoticeEmailListener {

    private final NotificationCreationService notificationCreationService;

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void onStudyNoticeSent(StudyNoticeSent event) {
        if (!event.sendEmail()) {
            return;
        }
        notificationCreationService.createStudyNoticeEmails(event.noticeId());
    }
}
