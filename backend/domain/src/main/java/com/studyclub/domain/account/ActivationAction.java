package com.studyclub.domain.account;

/** 계정을 처음 활성화한 행동 — 첫 스터디 신청 또는 첫 행사 신청 중 먼저 성공한 하나 (specs/event-registration 「퍼널·계측」, R4). */
public enum ActivationAction {
    STUDY_APPLIED,
    EVENT_APPLIED
}
