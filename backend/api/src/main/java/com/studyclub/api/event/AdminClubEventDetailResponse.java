package com.studyclub.api.event;

import com.studyclub.domain.event.ChannelSeats;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventChannel;
import com.studyclub.domain.event.ClubEventQuestion;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventDisplayStatus;
import com.studyclub.domain.event.EventFormat;
import com.studyclub.domain.event.EventQuestionType;
import com.studyclub.domain.event.EventReopenBlockedReason;
import com.studyclub.domain.event.EventSeatCounts;
import com.studyclub.domain.event.EventStatus;
import java.time.Instant;
import java.util.List;

/**
 * 운영 상세 — 편집 폼 값 전부 + 방식별 모집 현황 + 지금 할 수 있는 수정 · 상태 전환 + 취소 안내 대상 수 + 돌려보낼 버전. 등록 · 수정 · 상태 전환 응답도
 * 이 모양이다.
 */
public record AdminClubEventDetailResponse(
        Long eventId,
        Long version,
        String title,
        String summary,
        String description,
        String timeZone,
        Instant startsAt,
        Instant endsAt,
        Instant effectiveEndsAt,
        Instant deadlineAt,
        EventFormat format,
        Offline offline,
        Online online,
        EventConfirmation confirmation,
        EventStatus status,
        EventDisplayStatus displayStatus,
        Instant publishedAt,
        List<Question> questions,
        List<Seat> seats,
        boolean canEdit,
        boolean canChangeConfirmation,
        boolean canSetFutureStart,
        List<EventChannel> removableChannels,
        boolean canClose,
        boolean canReopen,
        EventReopenBlockedReason reopenBlockedReason,
        boolean canCancel,
        boolean hasCancellationRecipients,
        int cancellationRecipientCount,
        Instant createdAt,
        Instant updatedAt) {

    public record Offline(int capacity, String location) {}

    /** 캡틴에게는 그대로 보이지만 로그에는 남기지 않는다 — {@code toString} 이 링크를 가린다. */
    public record Online(int capacity, String url) {
        @Override
        public String toString() {
            return "Online[capacity=" + capacity + ", url=" + (url == null ? null : "***") + "]";
        }
    }

    public record Question(
            String questionId,
            String label,
            EventQuestionType type,
            boolean required,
            List<String> options) {}

    public record Seat(
            EventChannel channel, int capacity, int pending, int confirmed, int remaining) {}

    /** 판정은 전부 엔티티 메서드가 내린다 — 여기는 옮겨 담기만 한다. */
    static AdminClubEventDetailResponse of(
            ClubEvent event, Instant now, EventSeatCounts counts, int cancellationRecipientCount) {
        return new AdminClubEventDetailResponse(
                event.getId(),
                event.getVersion(),
                event.getTitle(),
                event.getSummary(),
                event.getDescription(),
                event.getTimeZone(),
                event.getStartsAt(),
                event.getEndsAt(),
                event.effectiveEndsAt(),
                event.getDeadlineAt(),
                event.format(),
                event.findChannel(EventChannel.OFFLINE)
                        .map(row -> new Offline(row.getCapacity(), row.getLocation()))
                        .orElse(null),
                event.findChannel(EventChannel.ONLINE)
                        .map(AdminClubEventDetailResponse::online)
                        .orElse(null),
                event.getConfirmation(),
                event.getStatus(),
                event.displayStatus(now, counts),
                event.getPublishedAt(),
                event.getQuestions().stream().map(AdminClubEventDetailResponse::question).toList(),
                event.seats(counts).stream().map(AdminClubEventDetailResponse::seat).toList(),
                event.canEdit(now),
                event.canChangeConfirmation(now),
                event.canSetFutureStart(now),
                event.removableChannels(counts),
                event.canClose(now),
                event.canReopen(now),
                event.reopenBlockedReason(now),
                event.canCancel(now),
                cancellationRecipientCount > 0,
                cancellationRecipientCount,
                event.getCreatedAt(),
                event.getUpdatedAt());
    }

    private static Online online(ClubEventChannel row) {
        return new Online(row.getCapacity(), row.getOnlineUrl());
    }

    private static Question question(ClubEventQuestion question) {
        return new Question(
                question.getQuestionKey(),
                question.getLabel(),
                question.getType(),
                question.isRequired(),
                question.getOptions());
    }

    private static Seat seat(ChannelSeats seats) {
        return new Seat(
                seats.channel(),
                seats.capacity(),
                seats.pending(),
                seats.confirmed(),
                seats.remaining());
    }
}
