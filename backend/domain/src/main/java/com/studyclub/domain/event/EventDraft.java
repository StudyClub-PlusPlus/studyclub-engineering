package com.studyclub.domain.event;

import static com.studyclub.domain.event.EventInputs.invalid;
import static com.studyclub.domain.event.EventInputs.requireText;
import static com.studyclub.domain.event.EventInputs.trim;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * 등록·수정 폼 한 장의 값 — 만들어지면 이미 유효하다. 시각과 무관한 규칙(글자 수 · 시간대 · 정원 · 선택지 · 시각끼리의 순서)을 여기서 본다. 현재 시각이 필요한
 * 규칙(미래 마감 · 저장 즉시 종료)과 저장된 값이 필요한 규칙은 {@link ClubEvent} 가 본다.
 *
 * <p>시각은 분 단위로 맞춘다 — 편집 폼이 분 단위라 초가 섞이면 「바꾸지 않은 마감」 비교가 흔들린다 (specs/event/spec.md 「시각과 시간대」).
 */
public record EventDraft(
        String title,
        String summary,
        String description,
        String timeZone,
        Instant startsAt,
        Instant endsAt,
        Instant deadlineAt,
        EventConfirmation confirmation,
        List<ChannelDraft> channels,
        List<QuestionDraft> questions) {

    public EventDraft {
        title = trim(title);
        summary = trim(summary);
        description = trim(description);
        timeZone = trim(timeZone);
        startsAt = toMinute(startsAt);
        endsAt = toMinute(endsAt);
        deadlineAt = toMinute(deadlineAt);
        channels = List.copyOf(channels);
        questions = List.copyOf(questions);
        validate(
                title,
                summary,
                description,
                timeZone,
                startsAt,
                endsAt,
                deadlineAt,
                confirmation,
                channels,
                questions);
    }

    public EventFormat format() {
        Set<EventChannel> present = EnumSet.noneOf(EventChannel.class);
        for (ChannelDraft channel : channels) {
            present.add(channel.channel());
        }
        return EventFormat.of(present);
    }

    public ChannelDraft channel(EventChannel channel) {
        for (ChannelDraft draft : channels) {
            if (draft.channel() == channel) {
                return draft;
            }
        }
        return null;
    }

    private static void validate(
            String title,
            String summary,
            String description,
            String timeZone,
            Instant startsAt,
            Instant endsAt,
            Instant deadlineAt,
            EventConfirmation confirmation,
            List<ChannelDraft> channels,
            List<QuestionDraft> questions) {
        requireText("title", title, EventLimits.TITLE_MAX);
        requireText("summary", summary, EventLimits.SUMMARY_MAX);
        requireText("description", description, EventLimits.DESCRIPTION_MAX);
        if (timeZone == null || !EventLimits.TIME_ZONES.contains(timeZone)) {
            throw invalid("timeZone", String.join(" · ", EventLimits.TIME_ZONES) + " 중 하나여야 합니다.");
        }
        if (startsAt == null) {
            throw invalid("startsAt", "시작 시각을 입력해 주세요.");
        }
        if (endsAt != null && !endsAt.isAfter(startsAt)) {
            throw invalid("endsAt", "종료 시각은 시작 시각 이후여야 합니다.");
        }
        if (deadlineAt == null) {
            throw invalid("deadlineAt", "신청 마감 시각을 입력해 주세요.");
        }
        if (deadlineAt.isAfter(startsAt)) {
            throw invalid("deadlineAt", "신청 마감은 시작 시각 이전이거나 같아야 합니다.");
        }
        if (confirmation == null) {
            throw invalid("confirmation", "확정 방식을 골라 주세요.");
        }
        validateChannels(channels);
        if (questions.size() > EventLimits.QUESTIONS_MAX) {
            throw invalid("questions", "질문은 최대 " + EventLimits.QUESTIONS_MAX + "개입니다.");
        }
        for (int i = 0; i < questions.size(); i++) {
            questions.get(i).validate("questions[" + i + "]");
        }
    }

    private static void validateChannels(List<ChannelDraft> channels) {
        if (channels.isEmpty()) {
            throw invalid("format", "참여 방식을 하나 이상 골라 주세요.");
        }
        Set<EventChannel> seen = EnumSet.noneOf(EventChannel.class);
        for (ChannelDraft channel : channels) {
            if (!seen.add(channel.channel())) {
                throw invalid(channel.channel().fieldName(), "참여 방식이 중복되었습니다.");
            }
            channel.validate();
        }
    }

    private static Instant toMinute(Instant value) {
        if (value == null) {
            return null;
        }
        return value.truncatedTo(ChronoUnit.MINUTES);
    }
}
