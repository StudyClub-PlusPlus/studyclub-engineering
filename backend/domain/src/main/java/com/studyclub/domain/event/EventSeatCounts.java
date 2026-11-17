package com.studyclub.domain.event;

/**
 * 한 행사의 참여 방식별 유효 신청 수 — {@code PENDING}(확인 대기) · {@code CONFIRMED}(참가 확정). 판정 메서드의 재료라 목록·상세·수정이
 * 모두 {@link ClubEventRegistrationPort} 의 같은 쿼리로 센 값을 넘긴다.
 */
public record EventSeatCounts(
        int onlinePending, int onlineConfirmed, int offlinePending, int offlineConfirmed) {

    private static final EventSeatCounts NONE = new EventSeatCounts(0, 0, 0, 0);

    public EventSeatCounts {
        if (onlinePending < 0
                || onlineConfirmed < 0
                || offlinePending < 0
                || offlineConfirmed < 0) {
            throw new IllegalArgumentException("신청 수는 0 이상이어야 합니다.");
        }
    }

    /** 신청이 하나도 없는 행사. */
    public static EventSeatCounts none() {
        return NONE;
    }

    /** 한 방식의 수를 바꾼 새 값. 어댑터가 GROUP BY 결과를 한 줄씩 채울 때 쓴다. */
    public EventSeatCounts with(EventChannel channel, int pending, int confirmed) {
        if (channel == EventChannel.ONLINE) {
            return new EventSeatCounts(pending, confirmed, offlinePending, offlineConfirmed);
        }
        return new EventSeatCounts(onlinePending, onlineConfirmed, pending, confirmed);
    }

    public int pending(EventChannel channel) {
        if (channel == EventChannel.ONLINE) {
            return onlinePending;
        }
        return offlinePending;
    }

    public int confirmed(EventChannel channel) {
        if (channel == EventChannel.ONLINE) {
            return onlineConfirmed;
        }
        return offlineConfirmed;
    }

    /** 자리를 차지한 신청 수 = 확인 대기 + 참가 확정. 참가 불가·신청 취소는 자리를 반환한다. */
    public int occupied(EventChannel channel) {
        return pending(channel) + confirmed(channel);
    }

    public int totalPending() {
        return onlinePending + offlinePending;
    }
}
