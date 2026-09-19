package com.studyclub.notification.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.SesClientBuilder;
import software.amazon.awssdk.services.ses.model.SendEmailRequest;

class SesMailClientTest {

    @Test
    @DisplayName("설정한 구성 세트를 SES 요청에 전달한다 — 인프라의 발송 정책을 적용한다")
    void sendsWithConfigurationSet() {
        SendEmailRequest request = sendAndCapture("welcome-notify");

        assertThat(request.configurationSetName()).isEqualTo("welcome-notify");
        assertThat(request.source()).isEqualTo("notify@example.com");
        assertThat(request.destination().toAddresses()).containsExactly("gildong@example.com");
        assertThat(request.message().subject().data()).isEqualTo("가입 환영");
        assertThat(request.message().body().text().data()).isEqualTo("홍길동님 환영합니다.");
        assertThat(request.message().body().text().charset()).isEqualTo("UTF-8");
    }

    @Test
    @DisplayName("구성 세트 미설정·빈 값은 전송하지 않는다 — SES 기본값을 사용한다")
    void omitsMissingConfigurationSet() {
        for (String value : new String[] {null, "", "  "}) {
            assertThat(sendAndCapture(value).configurationSetName()).isNull();
        }
    }

    private SendEmailRequest sendAndCapture(String configurationSetName) {
        SesClient sesClient = mock(SesClient.class);
        SesClientBuilder builder = mock(SesClientBuilder.class, RETURNS_SELF);
        when(builder.build()).thenReturn(sesClient);
        MailProperties.MailAccount account =
                new MailProperties.MailAccount(
                        "ap-northeast-2",
                        "notify.example.com",
                        "notify@example.com",
                        "test-access-key",
                        "test-secret-key",
                        configurationSetName);
        SesMailClient mailClient =
                new SesMailClient(new MailProperties(null, null, account, null, null));

        try (var sesFactory = mockStatic(SesClient.class)) {
            sesFactory.when(SesClient::builder).thenReturn(builder);
            mailClient.send(MailCategory.NOTIFY, "gildong@example.com", "가입 환영", "홍길동님 환영합니다.");
        } finally {
            mailClient.close();
        }

        ArgumentCaptor<SendEmailRequest> request = ArgumentCaptor.forClass(SendEmailRequest.class);
        verify(sesClient).sendEmail(request.capture());
        return request.getValue();
    }
}
