package com.studyclub.notification;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class NotificationTemplateTest {

    @Test
    @DisplayName("백오피스에서 추가하면 채널은 메일이고 수정한 캡틴이 남는다")
    void createIsEmailAndRecordsAdmin() {
        NotificationTemplate template =
                NotificationTemplate.create(NotificationEventType.USER_REGISTERED, "제목", "본문", 7L);

        assertThat(template.getEventType()).isEqualTo(NotificationEventType.USER_REGISTERED);
        assertThat(template.getChannel()).isEqualTo(NotificationChannel.EMAIL);
        assertThat(template.getSubject()).isEqualTo("제목");
        assertThat(template.getBody()).isEqualTo("본문");
        assertThat(template.getUpdatedByAdminId()).isEqualTo(7L);
    }

    @Test
    @DisplayName("수정하면 제목·본문·수정자가 바뀌고 채널은 그대로다")
    void editReplacesContentAndKeepsChannel() {
        NotificationTemplate template =
                NotificationTemplate.create(NotificationEventType.USER_REGISTERED, "제목", "본문", 7L);

        template.edit(NotificationEventType.USER_REGISTERED, "새 제목", "<p>새 본문</p>", 9L);

        assertThat(template.getSubject()).isEqualTo("새 제목");
        assertThat(template.getBody()).isEqualTo("<p>새 본문</p>");
        assertThat(template.getUpdatedByAdminId()).isEqualTo(9L);
        assertThat(template.getChannel()).isEqualTo(NotificationChannel.EMAIL);
    }
}
