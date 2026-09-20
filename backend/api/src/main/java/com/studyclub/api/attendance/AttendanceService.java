package com.studyclub.api.attendance;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AttendanceService {

    private static final Logger log = LoggerFactory.getLogger(AttendanceService.class);

    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final AccountRepository accountRepository;

    public AttendanceService(
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            AccountRepository accountRepository) {
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.accountRepository = accountRepository;
    }

    public AttendanceResponse getAttendances(Long studyId, Long studyGroupId, Long meetingId) {
        var study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(
                                () -> {
                                    log.error("Study not found: studyId={}", studyId);
                                    return new BusinessException(ErrorCode.NOT_FOUND);
                                });

        var group =
                studyGroupRepository
                        .findById(studyGroupId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (!studyId.equals(group.getStudyId())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "studyGroupId가 이 스터디에 속하지 않습니다.");
        }

        List<StudyParticipant> participants =
                studyParticipantRepository.findByStudyGroupId(studyGroupId);
        List<StudyMeeting> allMeetings =
                studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(studyGroupId);

        // meetingId가 주어지면 검증 후 응답 범위를 좁힌다; 율(rate) 계산은 항상 그룹 전체 기준
        List<StudyMeeting> meetings;
        if (meetingId != null) {
            meetings = allMeetings.stream().filter(m -> meetingId.equals(m.getId())).toList();
            if (meetings.isEmpty()) {
                throw new BusinessException(ErrorCode.NOT_FOUND);
            }
        } else {
            meetings = allMeetings;
        }

        List<Long> meetingIds = allMeetings.stream().map(StudyMeeting::getId).toList();
        List<StudyAttendance> allAttendances =
                meetingIds.isEmpty()
                        ? List.of()
                        : studyAttendanceRepository.findByStudyMeetingIdIn(meetingIds);

        // accountId → meetingId → attendance (matrix + 율 계산 공용)
        Map<Long, Map<Long, StudyAttendance>> accountIdToAttendanceMap =
                allAttendances.stream()
                        .collect(
                                Collectors.groupingBy(
                                        StudyAttendance::getAccountId,
                                        Collectors.toMap(
                                                StudyAttendance::getStudyMeetingId, a -> a)));

        Set<Long> accountIds =
                participants.stream()
                        .map(StudyParticipant::getAccountId)
                        .collect(Collectors.toSet());
        Map<Long, String> nicknames =
                accountRepository.findAllById(accountIds).stream()
                        .collect(Collectors.toMap(Account::getId, Account::getNickname));

        Instant now = Instant.now();
        double totalNumerator = 0;
        long totalDenominator = 0;

        List<AttendanceResponse.ParticipantAttendance> participantAttendances = new ArrayList<>();
        for (StudyParticipant p : participants) {
            Map<Long, StudyAttendance> meetingIdToAttendance =
                    accountIdToAttendanceMap.getOrDefault(p.getAccountId(), Map.of());

            List<AttendanceResponse.AttendanceEntry> participantAttendancePerMeeting =
                    meetings.stream()
                            .map(
                                    m -> {
                                        StudyAttendance att = meetingIdToAttendance.get(m.getId());
                                        return new AttendanceResponse.AttendanceEntry(
                                                m.getId(),
                                                att != null ? att.getStatus().name() : null);
                                    })
                            .toList();

            double[] numeratorDenominatorPair =
                    AttendanceRateCalculator.components(p, allMeetings, meetingIdToAttendance, now);
            if (numeratorDenominatorPair[1] > 0) {
                totalNumerator += numeratorDenominatorPair[0];
                totalDenominator += (long) numeratorDenominatorPair[1];
            }

            participantAttendances.add(
                    new AttendanceResponse.ParticipantAttendance(
                            p.getId(),
                            nicknames.getOrDefault(p.getAccountId(), ""),
                            participantAttendancePerMeeting,
                            AttendanceRateCalculator.rate(numeratorDenominatorPair)));
        }

        Double avgRate = totalDenominator == 0 ? null : totalNumerator / totalDenominator;

        List<AttendanceResponse.MeetingSummary> meetingSummaries =
                meetings.stream()
                        .map(
                                m ->
                                        new AttendanceResponse.MeetingSummary(
                                                m.getId(), m.getScheduledAt()))
                        .toList();

        return new AttendanceResponse(
                new AttendanceResponse.StudySummary(
                        study.getId(),
                        study.getTitle(),
                        participants.size(),
                        allMeetings.size(),
                        avgRate),
                meetingSummaries,
                participantAttendances);
    }
}
