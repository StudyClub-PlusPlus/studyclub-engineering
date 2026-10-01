package com.studyclub.api.study;

import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * 기수(STUDY)에 딸린 프로그램을 읽는 자리.
 *
 * <p>종류({@code STUDY_KIND})와 프로그램 제목은 STUDY_PROGRAM 소속인데 응답에는 기수와 함께 나간다
 * (docs/erd/STUDY_PROGRAM.md). 목록을 만들면서 행마다 프로그램을 따로 조회하면 행 수만큼 쿼리가 늘어나므로, 묶어 읽는 방법을 한 군데 두고 목록·상세가
 * 같이 쓴다.
 */
@Component
public class StudyProgramLookup {

    private final StudyProgramRepository studyProgramRepository;

    public StudyProgramLookup(StudyProgramRepository studyProgramRepository) {
        this.studyProgramRepository = studyProgramRepository;
    }

    /** 기수 묶음이 가리키는 프로그램을 한 번에 읽는다. 키는 {@code STUDY_PROGRAM.ID}. */
    public Map<Long, StudyProgram> forStudies(Collection<Study> studies) {
        Set<Long> programIds =
                studies.stream().map(Study::getProgramId).collect(Collectors.toSet());
        if (programIds.isEmpty()) {
            return Map.of();
        }
        return studyProgramRepository.findAllByIdIn(programIds).stream()
                .collect(Collectors.toMap(StudyProgram::getId, program -> program));
    }

    /** 기수 하나의 프로그램. */
    public StudyProgram of(Study study) {
        return studyProgramRepository
                .findById(study.getProgramId())
                .orElseThrow(() -> missing(study));
    }

    /**
     * {@link #forStudies} 로 읽어 둔 묶음에서 이 기수의 종류를 꺼낸다.
     *
     * <p>{@code PROGRAM_ID} 는 NOT NULL 이라 프로그램이 없을 수 없다. 없다면 데이터가 깨진 것이므로 기본값으로 때우지 않고 터뜨린다 — 종류를
     * 틀리게 보여 주면 「클럽만 기수를 붙인다」 판정이 조용히 어긋난다.
     */
    public static StudyKind kindOf(Map<Long, StudyProgram> programs, Study study) {
        StudyProgram program = programs.get(study.getProgramId());
        if (program == null) {
            throw missing(study);
        }
        return program.getStudyKind();
    }

    private static IllegalStateException missing(Study study) {
        return new IllegalStateException(
                "스터디 " + study.getId() + " 의 프로그램(" + study.getProgramId() + ")이 없습니다.");
    }
}
