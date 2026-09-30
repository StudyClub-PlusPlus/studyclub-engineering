package com.studyclub.api.study;

import com.studyclub.domain.study.Study;
import java.util.List;

interface BackofficeStudyDao {

    List<Study> getStudies(BackofficeStudyListFilter filter);
}
