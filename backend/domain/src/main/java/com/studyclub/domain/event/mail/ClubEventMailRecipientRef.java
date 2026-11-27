package com.studyclub.domain.event.mail;

/** 발송 한 건의 받는 사람 한 명이 어느 행사 · 어느 신청인지. */
public record ClubEventMailRecipientRef(
        Long mailId, Long clubEventId, Long accountId, Long registrationId) {}
