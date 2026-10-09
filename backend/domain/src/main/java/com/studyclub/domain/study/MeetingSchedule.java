package com.studyclub.domain.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 한 분반의 회차 일정 규칙 — 같은 날 중복 금지 · 한 번에 31일 · 지난 시각 금지 (specs/study-meeting/spec.md).
 *
 * <p>「같은 날」 은 UTC 가 아니라 분반 시간대의 현지 날짜다. 미주반 저녁 회차는 UTC 로 다음 날이 되기 때문이다. 31일도 같은 현지 날짜로 잰다 — UTC 경과
 * 시간으로 재면 서머타임이 낀 30일이 30일 1시간이 되어 정상 요청이 걸린다.
 */
public class MeetingSchedule {

    /** {@code STUDY_GROUP.TIMEZONE} 이 비어 있을 때. 손으로 넣은 옛 분반만 해당한다 — 반 편성은 시간대를 받는다. */
    public static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Seoul");

    static final int MAX_MEETINGS_PER_ADD = 31;
    // 시작일 포함 31일 → 첫 날과 마지막 날의 차이는 30일까지
    static final int MAX_SPAN_DAYS = 30;

    private static final DateTimeFormatter SHORT_DAY =
            DateTimeFormatter.ofPattern("M/d(E)", Locale.KOREAN);

    private final ZoneId zone;
    private final List<StudyMeeting> meetings;

    public MeetingSchedule(String timezone, List<StudyMeeting> meetings) {
        this.zone = zoneOf(timezone);
        this.meetings = meetings;
    }

    public static ZoneId zoneOf(String timezone) {
        return timezone == null || timezone.isBlank() ? DEFAULT_ZONE : ZoneId.of(timezone);
    }

    /**
     * 새 회차 시각들을 검증한다. 반복은 화면이 날짜로 펼쳐 보내므로 여기서는 결과 목록만 본다. 기존 회차와 같은 날은 건너뛰지 않고 막는다 — 화면이 미리보기에서 이미
     * 뺐으니, 남아 있다면 그 사이 누가 그 날에 회차를 만든 것이다.
     */
    public void checkAdd(Collection<Instant> scheduledAts, Instant now) {
        if (scheduledAts.isEmpty() || scheduledAts.size() > MAX_MEETINGS_PER_ADD) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "회차는 한 번에 1~" + MAX_MEETINGS_PER_ADD + "개까지 추가합니다.");
        }
        Set<LocalDate> days = new HashSet<>();
        for (Instant scheduledAt : scheduledAts) {
            assertFuture(scheduledAt, now);
            if (!days.add(localDate(scheduledAt))) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "같은 날에 회차를 두 번 넣을 수 없습니다.");
            }
        }
        LocalDate first = days.stream().min(LocalDate::compareTo).orElseThrow();
        LocalDate last = days.stream().max(LocalDate::compareTo).orElseThrow();
        if (ChronoUnit.DAYS.between(first, last) > MAX_SPAN_DAYS) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "반복은 시작일부터 " + (MAX_SPAN_DAYS + 1) + "일 안에서만 만듭니다.");
        }
        for (LocalDate day : days) {
            assertAfterKickoff(day, null);
        }
        for (LocalDate day : days) {
            assertDayFree(day, null);
        }
    }

    /**
     * 회차 하나를 옮길 때 — 자기 자신을 뺀 다른 회차와 같은 날이면 막는다. 정규 회차는 킥오프 뒤로만, 킥오프는 1회차 앞으로만 옮긴다 (결정 11). 킥오프가 없는
     * 옛 분반은 순서 규칙이 없다.
     */
    public void checkReschedule(StudyMeeting target, Instant scheduledAt) {
        LocalDate day = localDate(scheduledAt);
        if (target.isKickoff()) {
            assertBeforeFirstRegular(day, target);
        } else {
            assertAfterKickoff(day, target);
        }
        assertDayFree(day, target);
    }

    /**
     * 회차 번호 — 저장하지 않고 센다. 킥오프는 0, 정규 회차는 예정 시각 오름차순으로 1부터. {@code meetings} 는 예정 시각 오름차순이어야 한다.
     *
     * @return 회차 ID → 번호
     */
    public static Map<Long, Integer> numbersOf(List<StudyMeeting> meetings) {
        Map<Long, Integer> numbers = new HashMap<>();
        int next = 1;
        for (StudyMeeting meeting : meetings) {
            numbers.put(meeting.getId(), meeting.isKickoff() ? 0 : next++);
        }
        return numbers;
    }

    private void assertAfterKickoff(LocalDate day, StudyMeeting except) {
        for (StudyMeeting meeting : meetings) {
            if (meeting != except && meeting.isKickoff()) {
                LocalDate kickoff = localDate(meeting.getScheduledAt());
                if (!day.isAfter(kickoff)) {
                    throw new BusinessException(
                            ErrorCode.INVALID_INPUT,
                            "킥오프(" + kickoff.format(SHORT_DAY) + ") 뒤로만 회차를 만들 수 있습니다.");
                }
            }
        }
    }

    private void assertBeforeFirstRegular(LocalDate day, StudyMeeting kickoff) {
        for (StudyMeeting meeting : meetings) {
            if (meeting != kickoff && !meeting.isKickoff()) {
                LocalDate first = localDate(meeting.getScheduledAt());
                if (!day.isBefore(first)) {
                    throw new BusinessException(
                            ErrorCode.INVALID_INPUT,
                            "킥오프는 1회차(" + first.format(SHORT_DAY) + ")보다 앞이어야 합니다.");
                }
                // 오름차순이라 첫 정규 회차만 보면 된다
                return;
            }
        }
    }

    /**
     * 저장 정밀도(초)로 자른다. 운영 컬럼은 소수초 없는 DATETIME 이라 MySQL 이 반올림한다 — 자정 0.9초 전 회차가 다음 날로 저장되어, 검증한 날짜와
     * 저장된 날짜가 달라진다. 검증과 저장이 같은 값을 쓰게 한다.
     */
    static Instant storable(Instant instant) {
        return instant.truncatedTo(ChronoUnit.SECONDS);
    }

    static void assertFuture(Instant scheduledAt, Instant now) {
        if (!storable(scheduledAt).isAfter(now)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "지난 시각에는 회차를 잡을 수 없습니다.");
        }
    }

    private void assertDayFree(LocalDate day, StudyMeeting except) {
        for (StudyMeeting meeting : meetings) {
            if (meeting != except && localDate(meeting.getScheduledAt()).equals(day)) {
                throw new BusinessException(
                        ErrorCode.MEETING_DATE_CONFLICT, day + " 에 이미 회차가 있습니다.");
            }
        }
    }

    private LocalDate localDate(Instant instant) {
        return storable(instant).atZone(zone).toLocalDate();
    }
}
