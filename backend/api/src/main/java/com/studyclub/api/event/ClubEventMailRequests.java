package com.studyclub.api.event;

import static com.studyclub.domain.event.EventInputs.invalid;

import com.studyclub.domain.event.EventInputs;
import com.studyclub.domain.event.mail.ClubEventMail;
import com.studyclub.domain.event.mail.ClubEventMailAudience;
import com.studyclub.domain.event.mail.ClubEventMailType;
import java.util.Set;

/**
 * 행사 메일 요청 값 검사 — {@code type} · {@code audience} · {@code displayTimeZone} 을 문자열로 받아 필드 이름이 담긴 400
 * 으로 돌려준다.
 */
final class ClubEventMailRequests {

    /** 회원 시간대와 행사 시간대의 합. */
    static final Set<String> DISPLAY_TIME_ZONES =
            Set.of(
                    "Asia/Seoul",
                    "America/Toronto",
                    "America/New_York",
                    "America/Vancouver",
                    "America/Los_Angeles");

    /** 검사를 마친 요청. {@code notice} 는 앞뒤 공백을 지운 값(없으면 빈 문자열). */
    record Draft(
            ClubEventMailType type,
            ClubEventMailAudience audience,
            String notice,
            String displayTimeZone) {}

    private ClubEventMailRequests() {}

    static Draft preview(AdminClubEventMailPreviewRequest request) {
        return draft(
                request.type(), request.audience(), request.notice(), request.displayTimeZone());
    }

    /** 보내기는 안내 내용이 비면 400 이다 (미리보기는 막힌 이유로만 알린다). */
    static Draft send(AdminClubEventMailSendRequest request) {
        Draft draft =
                draft(
                        request.type(),
                        request.audience(),
                        request.notice(),
                        request.displayTimeZone());
        if (draft.notice().isEmpty()) {
            throw invalid("notice", "안내 내용을 입력해 주세요.");
        }
        return draft;
    }

    private static Draft draft(
            String type, String audience, String notice, String displayTimeZone) {
        ClubEventMailType parsedType = parse("type", type, ClubEventMailType.class);
        ClubEventMailAudience parsedAudience =
                parse("audience", audience, ClubEventMailAudience.class);
        if (!parsedAudience.allowedFor(parsedType)) {
            throw invalid(
                    "audience",
                    parsedType == ClubEventMailType.CANCELLATION
                            ? "취소 안내는 CANCELLED_ACTIVE 만 보낼 수 있습니다."
                            : "행사 안내는 ALL · ONLINE · OFFLINE 중 하나여야 합니다.");
        }
        String trimmed = EventInputs.trim(notice);
        String kept = trimmed == null ? "" : trimmed;
        if (kept.length() > ClubEventMail.NOTICE_MAX_LENGTH) {
            throw invalid("notice", ClubEventMail.NOTICE_MAX_LENGTH + "자 이하여야 합니다.");
        }
        if (displayTimeZone != null && !DISPLAY_TIME_ZONES.contains(displayTimeZone)) {
            throw invalid("displayTimeZone", "지원하지 않는 시간대입니다.");
        }
        return new Draft(parsedType, parsedAudience, kept, displayTimeZone);
    }

    private static <E extends Enum<E>> E parse(String field, String value, Class<E> type) {
        if (value != null) {
            for (E constant : type.getEnumConstants()) {
                if (constant.name().equals(value)) {
                    return constant;
                }
            }
        }
        StringBuilder names = new StringBuilder();
        for (E constant : type.getEnumConstants()) {
            if (!names.isEmpty()) {
                names.append(" · ");
            }
            names.append(constant.name());
        }
        throw invalid(field, names + " 중 하나여야 합니다.");
    }
}
