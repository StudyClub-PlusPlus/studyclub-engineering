package com.studyclub.api.auth.dto;

/** 닉네임 사용 가능 여부 조회 응답. */
public final class NicknameDtos {

    private NicknameDtos() {}

    /** 조회 시점의 사용 가능 여부이며 닉네임 예약을 의미하지 않는다. */
    public record AvailabilityResponse(boolean available) {}
}
