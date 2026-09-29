package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DiscordBotClientTest {

    @Test
    @DisplayName("API_키에_개행이_섞여도_키가_예외_메시지로_새지_않는다")
    void API_키에_개행이_섞여도_키가_예외_메시지로_새지_않는다() {
        // echo 로 만든 시크릿처럼 끝에 개행이 붙은 키. JDK 는 헤더 값을 통째로 메시지에 싣는다
        DiscordBotClient client =
                new DiscordBotClient("http://127.0.0.1:9", "FAKE_SECRET_MARKER\n");

        assertThatThrownBy(() -> client.createStudy("알고리즘 스터디", "1327394882193880001"))
                .isInstanceOf(BusinessException.class)
                .hasMessageNotContaining("FAKE_SECRET_MARKER")
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
    }
}
