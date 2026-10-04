package com.studyclub.api.study;

import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 백오피스 프로그램 목록 — 등록 모달에서 기수를 붙일 클럽을 고르는 데만 쓴다. */
@Service
@Transactional(readOnly = true)
public class AdminStudyProgramService {

    private final StudyProgramRepository studyProgramRepository;
    private final StudyRepository studyRepository;

    public AdminStudyProgramService(
            StudyProgramRepository studyProgramRepository, StudyRepository studyRepository) {
        this.studyProgramRepository = studyProgramRepository;
        this.studyRepository = studyRepository;
    }

    public AdminStudyProgramListResponse list(StudyKind studyKind) {
        List<StudyProgram> programs =
                studyProgramRepository.findAllByStudyKindOrderByTitleAsc(studyKind);
        if (programs.isEmpty()) {
            return new AdminStudyProgramListResponse(List.of());
        }

        List<Long> programIds = programs.stream().map(StudyProgram::getId).toList();
        // 프로그램마다 따로 조회하지 않는다 — 드롭다운 한 번에 N+1 이 난다
        Map<Long, Long> latestStudyIdByProgramId =
                studyRepository.findLatestByProgramIds(programIds).stream()
                        .collect(Collectors.toMap(Study::getProgramId, Study::getId, (a, b) -> a));

        return new AdminStudyProgramListResponse(
                programs.stream()
                        .map(
                                program ->
                                        new AdminStudyProgramListResponse.ProgramSummary(
                                                program.getId(),
                                                program.getTitle(),
                                                latestStudyIdByProgramId.get(program.getId())))
                        .toList());
    }
}
