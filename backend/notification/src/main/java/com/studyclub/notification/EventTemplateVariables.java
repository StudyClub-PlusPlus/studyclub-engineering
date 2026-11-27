package com.studyclub.notification;

import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 행사 알림 템플릿의 치환 변수 검사 (specs/event-mail 「템플릿 검증」). 행사 여섯 조건만 검사하고 기존 조건은 지금처럼 통과시킨다. 렌더러는 공백 없는
 * {@code {{name}}} 만 치환하므로 괄호 안에 공백이 있는 변수도 지원하지 않는 변수로 본다.
 */
public final class EventTemplateVariables {

    /** 렌더러가 치환하지 않는 모양까지 잡는다 — {@code {{ notice }}} · {@code {{foo-bar}}}. */
    private static final Pattern ANY_VARIABLE = Pattern.compile("\\{\\{(.*?)}}");

    private static final Pattern NAME = Pattern.compile("\\w+");

    private static final Set<String> COMMON =
            Set.of("nickname", "eventTitle", "eventSchedule", "channel");

    private static final Map<NotificationEventType, Set<String>> ALLOWED =
            new EnumMap<>(NotificationEventType.class);

    static {
        ALLOWED.put(
                NotificationEventType.EVENT_ANNOUNCEMENT,
                Set.of(
                        "nickname",
                        "eventTitle",
                        "channel",
                        "eventSchedule",
                        "participation",
                        "notice"));
        ALLOWED.put(
                NotificationEventType.EVENT_CANCELLATION,
                Set.of("nickname", "eventTitle", "notice"));
        ALLOWED.put(
                NotificationEventType.EVENT_REGISTRATION_CONFIRMED,
                Set.of("nickname", "eventTitle", "eventSchedule", "channel", "participation"));
        ALLOWED.put(NotificationEventType.EVENT_REGISTRATION_PENDING, COMMON);
        ALLOWED.put(NotificationEventType.EVENT_REGISTRATION_DECLINED, COMMON);
        ALLOWED.put(NotificationEventType.EVENT_REGISTRATION_CANCELLED, COMMON);
    }

    private EventTemplateVariables() {}

    /**
     * 저장할 수 없는 이유(화면 문구). 저장할 수 있으면 비어 있다. 지원하지 않는 변수를 먼저 보고, 안내 · 취소 안내는 본문에 {@code {{notice}}} 가
     * 있어야 한다.
     */
    public static Optional<String> problem(
            NotificationEventType eventType, String subject, String body) {
        Set<String> allowed = ALLOWED.get(eventType);
        if (allowed == null) {
            return Optional.empty();
        }
        Set<String> used = new LinkedHashSet<>();
        collect(subject, used);
        collect(body, used);
        for (String variable : used) {
            if (!NAME.matcher(variable).matches() || !allowed.contains(variable)) {
                return Optional.of("지원하지 않는 변수입니다: {{" + variable + "}}");
            }
        }
        boolean needsNotice =
                eventType == NotificationEventType.EVENT_ANNOUNCEMENT
                        || eventType == NotificationEventType.EVENT_CANCELLATION;
        if (needsNotice && (body == null || !body.contains("{{notice}}"))) {
            return Optional.of("행사 안내 내용이 들어갈 {{notice}}를 본문에 넣어 주세요.");
        }
        return Optional.empty();
    }

    private static void collect(String text, Set<String> into) {
        if (text == null) {
            return;
        }
        Matcher matcher = ANY_VARIABLE.matcher(text);
        while (matcher.find()) {
            into.add(matcher.group(1));
        }
    }
}
