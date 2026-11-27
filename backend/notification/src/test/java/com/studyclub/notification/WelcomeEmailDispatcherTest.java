package com.studyclub.notification;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.notification.mail.MailCategory;
import com.studyclub.notification.mail.MailClient;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 발송 조립 — 템플릿 원문 스냅샷이 있는 행은 템플릿을 다시 읽지 않는다. */
class WelcomeEmailDispatcherTest {

    private final NotificationTemplateRepository templates =
            mock(NotificationTemplateRepository.class);
    private final MailClient mailClient = mock(MailClient.class);
    private final WelcomeEmailDispatcher dispatcher =
            new WelcomeEmailDispatcher(templates, new NotificationTemplateRenderer(), mailClient);

    @Test
    @DisplayName("행사 메일 — 템플릿이 지워져도 스냅샷 + PAYLOAD 로 보내고, HTML 값의 줄바꿈은 <br>")
    void clubEventMailUsesSnapshot() {
        NotificationTemplate snapshot =
                new NotificationTemplate(
                        NotificationEventType.EVENT_ANNOUNCEMENT,
                        NotificationChannel.EMAIL,
                        "[StudyClub] {{eventTitle}} 안내",
                        "<p>{{notice}}</p>");
        Notification row =
                Notification.pendingClubEventMail(
                        NotificationEventType.EVENT_ANNOUNCEMENT,
                        "crew@example.com",
                        1L,
                        snapshot,
                        Map.of("eventTitle", "밋업", "notice", "첫 줄\n둘째 줄"),
                        21L,
                        7L);

        dispatcher.dispatch(row);

        verify(templates, never()).findById(any());
        verify(mailClient)
                .send(
                        MailCategory.NOTIFY,
                        "crew@example.com",
                        "[StudyClub] 밋업 안내",
                        "<p>첫 줄<br>둘째 줄</p>");
    }

    @Test
    @DisplayName("기존 조건 — 지금처럼 TEMPLATE_ID 로 템플릿을 읽고 줄바꿈을 바꾸지 않는다")
    void legacyReadsTemplate() {
        NotificationTemplate template =
                new NotificationTemplate(
                        NotificationEventType.STUDY_NOTICE,
                        NotificationChannel.EMAIL,
                        "{{title}}",
                        "<p>{{body}}</p>");
        when(templates.findById(10L)).thenReturn(Optional.of(template));
        Notification row =
                Notification.pendingImmediate(
                        NotificationEventType.STUDY_NOTICE,
                        NotificationChannel.EMAIL,
                        "crew@example.com",
                        1L,
                        10L,
                        Map.of("title", "공지", "body", "a\nb"));

        dispatcher.dispatch(row);

        verify(mailClient).send(MailCategory.NOTIFY, "crew@example.com", "공지", "<p>a\nb</p>");
    }
}
