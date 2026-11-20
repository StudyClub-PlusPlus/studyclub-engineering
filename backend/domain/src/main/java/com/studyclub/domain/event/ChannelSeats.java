package com.studyclub.domain.event;

/** 참여 방식 하나의 모집 현황. {@code remaining = max(0, capacity − (pending + confirmed))}. */
public record ChannelSeats(
        EventChannel channel, int capacity, int pending, int confirmed, int remaining) {

    public boolean isFull() {
        return remaining == 0;
    }
}
