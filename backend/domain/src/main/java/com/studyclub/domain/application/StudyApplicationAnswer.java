package com.studyclub.domain.application;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record StudyApplicationAnswer(
        String discordNickname,
        List<ApplicationDay> availableDays,
        Boolean scheduleAgreed,
        Map<String, Object> answers) {

    public static StudyApplicationAnswer create(
            String rawDiscordNickname,
            List<String> rawAvailableDays,
            Boolean rawScheduleAgreed,
            Map<String, Object> rawAnswers,
            boolean hasSchedule,
            List<ApplicationFormQuestion> questions) {
        String discordNickname = requiredSingleLine(rawDiscordNickname, 100, "discordNickname");
        List<ApplicationDay> availableDays = normalizeDays(rawAvailableDays);
        Map<String, Object> answers = normalizeExtraAnswers(questions, rawAnswers);
        Boolean scheduleAgreed = normalizeScheduleAgreement(hasSchedule, rawScheduleAgreed);
        return new StudyApplicationAnswer(
                discordNickname,
                List.copyOf(availableDays),
                scheduleAgreed,
                Collections.unmodifiableMap(new LinkedHashMap<>(answers)));
    }

    private static List<ApplicationDay> normalizeDays(List<String> rawDays) {
        if (rawDays == null || rawDays.isEmpty()) {
            throw invalid("availableDays", "empty");
        }
        if (rawDays.size() > ApplicationDay.values().length) {
            throw invalid("availableDays", "max");
        }
        LinkedHashSet<ApplicationDay> days = new LinkedHashSet<>();
        try {
            for (String rawDay : rawDays) {
                if (!days.add(ApplicationDay.fromKey(rawDay))) {
                    throw invalid("availableDays", "enum");
                }
            }
        } catch (IllegalArgumentException e) {
            throw invalid("availableDays", "enum");
        }
        return List.copyOf(days);
    }

    private static Boolean normalizeScheduleAgreement(boolean hasSchedule, Boolean agreed) {
        if (hasSchedule && !Boolean.TRUE.equals(agreed)) {
            throw invalid("scheduleAgreed", "empty");
        }
        if (!hasSchedule && Boolean.TRUE.equals(agreed)) {
            throw invalid("scheduleAgreed", "unexpected");
        }
        return hasSchedule ? Boolean.TRUE : null;
    }

    private static Map<String, Object> normalizeExtraAnswers(
            List<ApplicationFormQuestion> questions, Map<String, Object> rawAnswers) {
        if (rawAnswers == null) {
            throw invalid("answers", "empty");
        }
        Set<String> questionIds = new HashSet<>();
        questions.forEach(question -> questionIds.add(question.id()));
        if (!questionIds.containsAll(rawAnswers.keySet())) {
            throw invalid("answers", "unknown-question");
        }

        Map<String, Object> answers = new LinkedHashMap<>();
        for (ApplicationFormQuestion question : questions) {
            Object normalized = normalizeExtraAnswer(question, rawAnswers.get(question.id()));
            if (normalized != null) {
                answers.put(question.id(), normalized);
            }
        }
        return answers;
    }

    private static Object normalizeExtraAnswer(ApplicationFormQuestion question, Object raw) {
        ApplicationFormQuestionType type = question.type();
        if (type == null) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR);
        }
        return switch (type) {
            case TEXT -> normalizeText(question, raw, 200, false);
            case TEXTAREA -> normalizeText(question, raw, 2_000, true);
            case RADIO, SELECT -> normalizeSingleChoice(question, raw);
            case CHECKBOX -> normalizeMultipleChoice(question, raw);
        };
    }

    private static String normalizeText(
            ApplicationFormQuestion question, Object raw, int max, boolean multiline) {
        if (raw == null) {
            return requiredOrNull(question);
        }
        if (!(raw instanceof String value)) {
            throw invalid(answerField(question), "type");
        }
        String normalized = multiline ? value.trim() : singleLine(value);
        if (normalized.isEmpty()) {
            return requiredOrNull(question);
        }
        if (normalized.length() > max) {
            throw invalid(answerField(question), "max");
        }
        return normalized;
    }

    private static String normalizeSingleChoice(ApplicationFormQuestion question, Object raw) {
        if (raw == null) {
            return requiredOrNull(question);
        }
        if (!(raw instanceof String value)) {
            throw invalid(answerField(question), "type");
        }
        String normalized = singleLine(value);
        if (normalized.isEmpty()) {
            return requiredOrNull(question);
        }
        if (question.options().contains(normalized)) {
            return normalized;
        }
        if (!Boolean.TRUE.equals(question.allowOther())) {
            throw invalid(answerField(question), "enum");
        }
        if (normalized.length() > 100) {
            throw invalid(answerField(question), "other-max");
        }
        return normalized;
    }

    private static List<String> normalizeMultipleChoice(
            ApplicationFormQuestion question, Object raw) {
        if (raw == null) {
            return requiredListOrNull(question);
        }
        if (!(raw instanceof List<?> values)) {
            throw invalid(answerField(question), "type");
        }
        List<String> normalized = new ArrayList<>();
        for (Object value : values) {
            if (!(value instanceof String stringValue)) {
                throw invalid(answerField(question), "type");
            }
            String choice = singleLine(stringValue);
            if (choice.isEmpty()) {
                throw invalid(
                        answerField(question),
                        Boolean.TRUE.equals(question.allowOther()) ? "other-empty" : "enum");
            }
            normalized.add(choice);
        }
        if (normalized.isEmpty()) {
            return requiredListOrNull(question);
        }
        if (new HashSet<>(normalized).size() != normalized.size()) {
            throw invalid(answerField(question), "enum");
        }
        List<String> other =
                normalized.stream().filter(value -> !question.options().contains(value)).toList();
        if (!other.isEmpty() && !Boolean.TRUE.equals(question.allowOther())) {
            throw invalid(answerField(question), "enum");
        }
        if (other.size() > 1) {
            throw invalid(answerField(question), "enum");
        }
        if (!other.isEmpty() && other.get(0).length() > 100) {
            throw invalid(answerField(question), "other-max");
        }
        return List.copyOf(normalized);
    }

    private static String requiredOrNull(ApplicationFormQuestion question) {
        if (Boolean.TRUE.equals(question.required())) {
            throw invalid(answerField(question), "empty");
        }
        return null;
    }

    private static List<String> requiredListOrNull(ApplicationFormQuestion question) {
        if (Boolean.TRUE.equals(question.required())) {
            throw invalid(answerField(question), "empty");
        }
        return null;
    }

    private static String requiredSingleLine(String value, int max, String field) {
        String normalized = singleLine(value);
        if (normalized.isEmpty()) {
            throw invalid(field, "empty");
        }
        if (normalized.length() > max) {
            throw invalid(field, "max");
        }
        return normalized;
    }

    private static String singleLine(String value) {
        return value == null ? "" : value.replaceAll("[\\r\\n\\t]+", " ").trim();
    }

    private static String answerField(ApplicationFormQuestion question) {
        return "answers." + question.id();
    }

    private static BusinessException invalid(String field, String reason) {
        return new BusinessException(ErrorCode.INVALID_INPUT, field + ": " + reason);
    }
}
