package com.studyclub.api.discord;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * @param studyName 디스코드에 만들 이름. 없으면 스터디 제목. 봇 한도가 공백을 자른 뒤 96자다
 */
public record StudyDiscordLinkRequest(
        @Pattern(regexp = ".*\\S.*", message = "공백만으로 된 이름은 쓸 수 없습니다.") @Size(max = 96) String studyName) {}
