package com.studyclub.notification;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EventTemplateVariablesTest {

    @Test
    @DisplayName("안내 · 취소 안내는 본문에 {{notice}} 가 있어야 한다")
    void noticeRequired() {
        assertThat(
                        EventTemplateVariables.problem(
                                NotificationEventType.EVENT_ANNOUNCEMENT,
                                "[StudyClub] {{eventTitle}} 안내",
                                "<p>{{nickname}}님</p>"))
                .contains("행사 안내 내용이 들어갈 {{notice}}를 본문에 넣어 주세요.");
        assertThat(
                        EventTemplateVariables.problem(
                                NotificationEventType.EVENT_CANCELLATION,
                                "{{notice}}",
                                "<p>본문</p>"))
                .contains("행사 안내 내용이 들어갈 {{notice}}를 본문에 넣어 주세요.");
        assertThat(
                        EventTemplateVariables.problem(
                                NotificationEventType.EVENT_ANNOUNCEMENT,
                                "[StudyClub] {{eventTitle}} 안내",
                                "{{nickname}} {{channel}} {{eventSchedule}} {{participation}} {{notice}}"))
                .isEmpty();
    }

    @Test
    @DisplayName("조건별로 허용 밖 변수 · 괄호 안 공백 변수는 지원하지 않는 변수다 — 제목도 본다")
    void unsupported() {
        assertThat(
                        EventTemplateVariables.problem(
                                NotificationEventType.EVENT_CANCELLATION,
                                "제목",
                                "{{notice}} {{participation}}"))
                .contains("지원하지 않는 변수입니다: {{participation}}");
        assertThat(
                        EventTemplateVariables.problem(
                                NotificationEventType.EVENT_ANNOUNCEMENT, "제목", "{{ notice }}"))
                .contains("지원하지 않는 변수입니다: {{ notice }}");
        assertThat(
                        EventTemplateVariables.problem(
                                NotificationEventType.EVENT_REGISTRATION_PENDING,
                                "{{eventTitle}} {{participation}}",
                                "본문"))
                .contains("지원하지 않는 변수입니다: {{participation}}");
        assertThat(
                        EventTemplateVariables.problem(
                                NotificationEventType.EVENT_REGISTRATION_CONFIRMED,
                                "{{eventTitle}}",
                                "{{nickname}} {{eventSchedule}} {{channel}} {{participation}}"))
                .isEmpty();
    }

    @Test
    @DisplayName("기존 세 조건은 검사하지 않는다")
    void legacyConditionsPass() {
        for (NotificationEventType type :
                new NotificationEventType[] {
                    NotificationEventType.USER_REGISTERED,
                    NotificationEventType.STUDY_NOTICE,
                    NotificationEventType.FEEDBACK_REPLIED
                }) {
            assertThat(EventTemplateVariables.problem(type, "{{ foo }}", "{{bar}}")).isEmpty();
        }
    }
}
