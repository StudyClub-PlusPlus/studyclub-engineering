package com.studyclub.api.notice;

/** 접수 결과. <b>보냈다는 뜻이 아니다</b> — 메일이 나갔는지·디스코드가 올라갔는지는 기록 조회로 본다. */
public record StudyNoticeSendResponse(Long noticeId, int recipientCount) {}
