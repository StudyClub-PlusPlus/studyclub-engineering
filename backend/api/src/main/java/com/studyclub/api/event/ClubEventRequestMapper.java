package com.studyclub.api.event;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.event.ChannelDraft;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventDraft;
import com.studyclub.domain.event.EventFormat;
import com.studyclub.domain.event.EventQuestionType;
import com.studyclub.domain.event.QuestionDraft;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * 요청 본문 → {@link EventDraft}. 여기는 <b>모양</b>만 본다 — 필수 값 · enum 이름 · 시각 형식 · {@code format} 과 {@code
 * online}/{@code offline} 객체가 맞는지 · 등록·수정의 기본값 차이. 글자 수 · 정원 · 선택지 같은 값의 규칙은 {@link EventDraft} 가
 * 본다. 실패 메시지는 {@code 필드: 이유} 모양이다.
 */
final class ClubEventRequestMapper {

    private ClubEventRequestMapper() {}

    /**
     * 등록 — {@code confirmation} 생략은 {@code AUTO}, {@code questions} 생략은 빈 배열. 질문 ID 는 비어 있어야 한다.
     */
    static EventDraft toCreateDraft(AdminClubEventRequest request) {
        requireBody(request);
        EventConfirmation confirmation = EventConfirmation.AUTO;
        if (request.confirmation() != null) {
            confirmation = confirmation(request.confirmation());
        }
        List<AdminClubEventRequest.Question> questions = request.questions();
        if (questions == null) {
            questions = List.of();
        }
        for (int i = 0; i < questions.size(); i++) {
            AdminClubEventRequest.Question question = questions.get(i);
            if (question != null && question.questionId() != null) {
                throw invalid("questions[" + i + "].questionId", "등록에서는 비워 둡니다.");
            }
        }
        return draft(request, confirmation, questions);
    }

    /**
     * 수정 — {@code version} · {@code confirmation} · {@code questions} 가 필수다. 등록 기본값을 채우면 제목만 고친 요청이
     * 확인 대기자를 자동 확정하거나 질문을 지운다 (PR #470 리뷰).
     */
    static EventDraft toUpdateDraft(AdminClubEventRequest request) {
        requireBody(request);
        if (request.version() == null) {
            throw invalid("version", "운영 상세에서 받은 버전을 보내 주세요.");
        }
        if (request.confirmation() == null) {
            throw invalid("confirmation", "확정 방식을 보내 주세요.");
        }
        if (request.questions() == null) {
            throw invalid("questions", "질문 목록을 보내 주세요. 모두 지우려면 빈 배열을 보냅니다.");
        }
        return draft(request, confirmation(request.confirmation()), request.questions());
    }

    private static EventDraft draft(
            AdminClubEventRequest request,
            EventConfirmation confirmation,
            List<AdminClubEventRequest.Question> questions) {
        Instant startsAt = requiredInstant("startsAt", request.startsAt());
        Instant endsAt = optionalInstant("endsAt", request.endsAt());
        Instant deadlineAt = requiredInstant("deadlineAt", request.deadlineAt());
        return new EventDraft(
                request.title(),
                request.summary(),
                request.description(),
                request.timeZone(),
                startsAt,
                endsAt,
                deadlineAt,
                confirmation,
                channels(request),
                questions(questions));
    }

    private static List<ChannelDraft> channels(AdminClubEventRequest request) {
        EventFormat format = parse("format", request.format(), EventFormat.class);
        List<ChannelDraft> channels = new ArrayList<>();
        AdminClubEventRequest.Online online = request.online();
        if (format.includes(EventChannel.ONLINE) != (online != null)) {
            throw presenceMismatch("online", format, online != null);
        }
        AdminClubEventRequest.Offline offline = request.offline();
        if (format.includes(EventChannel.OFFLINE) != (offline != null)) {
            throw presenceMismatch("offline", format, offline != null);
        }
        if (online != null) {
            channels.add(
                    ChannelDraft.online(
                            requiredCapacity("online.capacity", online.capacity()), online.url()));
        }
        if (offline != null) {
            channels.add(
                    ChannelDraft.offline(
                            requiredCapacity("offline.capacity", offline.capacity()),
                            offline.location()));
        }
        return channels;
    }

    private static List<QuestionDraft> questions(List<AdminClubEventRequest.Question> questions) {
        List<QuestionDraft> drafts = new ArrayList<>();
        for (int i = 0; i < questions.size(); i++) {
            String prefix = "questions[" + i + "]";
            AdminClubEventRequest.Question question = questions.get(i);
            if (question == null) {
                throw invalid(prefix, "질문을 비워 둘 수 없습니다.");
            }
            EventQuestionType type =
                    parse(prefix + ".type", question.type(), EventQuestionType.class);
            if (question.required() == null) {
                throw invalid(prefix + ".required", "필수 여부를 보내 주세요.");
            }
            if (question.options() == null) {
                throw invalid(prefix + ".options", "선택지 배열을 보내 주세요. 단답·장문은 빈 배열입니다.");
            }
            drafts.add(
                    new QuestionDraft(
                            question.questionId(),
                            question.label(),
                            type,
                            question.required(),
                            question.options()));
        }
        return drafts;
    }

    private static void requireBody(AdminClubEventRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
    }

    private static EventConfirmation confirmation(String value) {
        return parse("confirmation", value, EventConfirmation.class);
    }

    private static int requiredCapacity(String field, Integer capacity) {
        if (capacity == null) {
            throw invalid(field, "정원을 입력해 주세요.");
        }
        return capacity;
    }

    private static Instant requiredInstant(String field, String value) {
        if (value == null || value.isBlank()) {
            throw invalid(field, "UTC ISO 8601 시각을 입력해 주세요.");
        }
        return instant(field, value);
    }

    private static Instant optionalInstant(String field, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return instant(field, value);
    }

    private static Instant instant(String field, String value) {
        try {
            return Instant.parse(value.strip());
        } catch (DateTimeParseException e) {
            throw invalid(field, "UTC ISO 8601 시각이어야 합니다 (예: 2026-12-05T10:00:00Z).");
        }
    }

    /** enum 이름과 정확히 같을 때만 받는다 — {@code SELECT} 같은 없는 값은 400. */
    private static <E extends Enum<E>> E parse(String field, String value, Class<E> type) {
        if (value != null) {
            for (E constant : type.getEnumConstants()) {
                if (constant.name().equals(value)) {
                    return constant;
                }
            }
        }
        List<String> names = new ArrayList<>();
        for (E constant : type.getEnumConstants()) {
            names.add(constant.name());
        }
        throw invalid(field, String.join(" · ", names) + " 중 하나여야 합니다.");
    }

    private static BusinessException presenceMismatch(
            String field, EventFormat format, boolean present) {
        if (present) {
            return invalid(field, "format 이 " + format.name() + " 이면 보내지 않습니다.");
        }
        return invalid(field, "format 이 " + format.name() + " 이면 필요합니다.");
    }

    private static BusinessException invalid(String field, String reason) {
        return new BusinessException(ErrorCode.INVALID_INPUT, field + ": " + reason);
    }
}
