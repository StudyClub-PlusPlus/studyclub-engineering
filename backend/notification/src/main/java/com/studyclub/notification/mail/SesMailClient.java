package com.studyclub.notification.mail;

import com.studyclub.notification.NotificationErrorType;
import jakarta.annotation.PreDestroy;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.Body;
import software.amazon.awssdk.services.ses.model.Content;
import software.amazon.awssdk.services.ses.model.Destination;
import software.amazon.awssdk.services.ses.model.Message;
import software.amazon.awssdk.services.ses.model.MessageRejectedException;
import software.amazon.awssdk.services.ses.model.SendEmailRequest;

/**
 * {@link MailClient} 의 유일한 구현체. 카테고리별로 리전·자격증명이 달라 {@link SesClient} 를 카테고리마다 하나씩 지연 생성해 캐시한다 — 매
 * 발송마다 새로 만들지 않는다.
 */
@Component
@RequiredArgsConstructor
public class SesMailClient implements MailClient {

    private final MailProperties mailProperties;
    private final Map<MailCategory, SesClient> clients = new ConcurrentHashMap<>();

    @Override
    public void send(MailCategory category, String to, String subject, String body) {
        try {
            MailProperties.MailAccount account = accountFor(category);
            clientFor(category, account).sendEmail(buildRequest(account, to, subject, body));
        } catch (MessageRejectedException e) {
            throw mailSendException(NotificationErrorType.INVALID_RECIPIENT, "SES 가 메일을 거부했습니다", e);
        } catch (SdkException e) {
            throw mailSendException(NotificationErrorType.PROVIDER_ERROR, "SES 발송 실패", e);
        } catch (RuntimeException e) {
            // SesClient 생성 실패(자격증명·리전 값이 비어있는 등)도 여기서 잡는다 — 호출자는 항상
            // MailSendException 만 알면 된다.
            throw mailSendException(NotificationErrorType.UNKNOWN, "예상하지 못한 발송 실패", e);
        }
    }

    private MailProperties.MailAccount accountFor(MailCategory category) {
        MailProperties.MailAccount account = mailProperties.get(category);
        if (account == null) {
            throw new IllegalStateException("메일 설정이 없습니다. category=" + category);
        }
        return account;
    }

    private SesClient clientFor(MailCategory category, MailProperties.MailAccount account) {
        return clients.computeIfAbsent(category, ignored -> buildClient(account));
    }

    private SendEmailRequest buildRequest(
            MailProperties.MailAccount account, String to, String subject, String body) {
        SendEmailRequest.Builder request =
                SendEmailRequest.builder()
                        .source(account.fromAddress())
                        .destination(Destination.builder().toAddresses(to).build())
                        .message(buildMessage(subject, body));
        String configurationSetName = account.configurationSetName();
        if (configurationSetName != null && !configurationSetName.isBlank()) {
            request.configurationSetName(configurationSetName);
        }
        return request.build();
    }

    private Message buildMessage(String subject, String body) {
        return Message.builder()
                .subject(textContent(subject))
                .body(Body.builder().text(textContent(body)).build())
                .build();
    }

    private Content textContent(String value) {
        return Content.builder().data(value).charset("UTF-8").build();
    }

    private MailSendException mailSendException(
            NotificationErrorType errorType, String message, RuntimeException cause) {
        return new MailSendException(errorType, message, cause);
    }

    @PreDestroy
    public void close() {
        clients.values().forEach(SesClient::close);
    }

    private SesClient buildClient(MailProperties.MailAccount account) {
        return SesClient.builder()
                .region(Region.of(account.region()))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(
                                        account.accessKeyId(), account.secretAccessKey())))
                .build();
    }
}
