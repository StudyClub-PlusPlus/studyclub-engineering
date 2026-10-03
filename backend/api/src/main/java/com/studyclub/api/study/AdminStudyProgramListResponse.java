package com.studyclub.api.study;

import java.util.List;

/**
 * 등록 모달의 「기존 클럽의 새 기수」 드롭다운이 쓰는 목록 — <b>프로그램 제목만 나열한다.</b>
 *
 * <p>{@code latestStudyId} 는 그 프로그램의 가장 최근 기수다. 프로그램을 고르면 화면이 이 id 로 기존 상세 API({@code GET
 * /api/admin/studies/{id}})를 불러 소개·설명·주제를 채운다 — 같은 값을 여기서 한 번 더 내려 주면 상세 응답과 어긋날 자리가 생긴다.
 */
public record AdminStudyProgramListResponse(List<ProgramSummary> items) {

    /** 기수가 하나도 없는 프로그램이면 {@code latestStudyId} 는 null 이다 — 채워 넣을 값이 없다. */
    public record ProgramSummary(Long programId, String title, Long latestStudyId) {}
}
