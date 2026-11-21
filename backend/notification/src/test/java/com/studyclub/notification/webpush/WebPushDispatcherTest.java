package com.studyclub.notification.webpush;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationErrorType;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRenderer;
import com.studyclub.notification.NotificationTemplateRepository;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class WebPushDispatcherTest {

    private final NotificationTemplateRepository templates =
            mock(NotificationTemplateRepository.class);
    private final WebPushSubscriptionRepository subscriptions =
            mock(WebPushSubscriptionRepository.class);
    private final WebPushClient client = mock(WebPushClient.class);
    private final WebPushDispatcher dispatcher =
            new WebPushDispatcher(
                    templates, new NotificationTemplateRenderer(), subscriptions, client);
    private final WebPushSubscription subscription =
            WebPushSubscription.register(7L, "https://fcm.googleapis.com/fcm/send/x", "k", "a");
    private final Notification notification =
            Notification.pendingImmediate(
                    NotificationEventType.ADMIN_PUSH,
                    NotificationChannel.WEB_PUSH,
                    "3",
                    7L,
                    1L,
                    Map.of("title", "모임 공지", "body", "내일 7시", "url", "/studies/1"));

    {
        when(templates.findById(1L))
                .thenReturn(
                        Optional.of(
                                new NotificationTemplate(
                                        NotificationEventType.ADMIN_PUSH,
                                        NotificationChannel.WEB_PUSH,
                                        "{{title}}",
                                        "{{body}}")));
        when(subscriptions.findById(3L)).thenReturn(Optional.of(subscription));
    }

    @Test
    @DisplayName("제목·본문·링크를 서비스 워커가 읽는 JSON 으로 싣는다")
    void sendsRenderedJson() {
        when(client.send(any(), anyString())).thenReturn(true);
        dispatcher.dispatch(notification);
        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(client).send(any(), json.capture());
        assertThat(json.getValue())
                .isEqualTo("{\"title\":\"모임 공지\",\"body\":\"내일 7시\",\"url\":\"/studies/1\"}");
    }

    @Test
    @DisplayName("푸시 서버가 만료를 알리면 구독을 지우고 INVALID_RECIPIENT 로 실패한다")
    void goneSubscriptionIsDeleted() {
        when(client.send(any(), anyString())).thenReturn(false);
        assertThatThrownBy(() -> dispatcher.dispatch(notification))
                .isInstanceOfSatisfying(
                        WebPushSendException.class,
                        e ->
                                assertThat(e.errorType())
                                        .isEqualTo(NotificationErrorType.INVALID_RECIPIENT));
        verify(subscriptions).delete(subscription);
    }
}
