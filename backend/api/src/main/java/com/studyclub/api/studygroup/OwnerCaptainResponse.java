package com.studyclub.api.studygroup;

/** 담당 캡틴 바꾸기 결과. specs/study-group/spec.md 「담당 캡틴 바꾸기」 */
public record OwnerCaptainResponse(Long studyId, OwnerCaptain ownerCaptain) {

    /** 담당 캡틴 — 참여 명단 응답의 {@code ownerCaptain} 과 같은 모양. */
    public record OwnerCaptain(Long accountId, String nickname) {}
}
