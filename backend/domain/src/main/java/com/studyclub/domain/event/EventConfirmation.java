package com.studyclub.domain.event;

/** 참가 확정 방식. {@code AUTO} 는 신청이 바로 참가 확정, {@code REVIEW} 는 확인 대기로 접수된다. */
public enum EventConfirmation {
    AUTO,
    REVIEW
}
