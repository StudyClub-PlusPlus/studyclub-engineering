package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

/** 서비스 키가 배포에서 빠졌을 때. 빈 키를 "검사 없음" 으로 읽으면 설정 누락이 곧 공개 엔드포인트가 되므로, 그때는 <b>아무도</b> 통과하지 못해야 한다. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "discord.api-key=")
@AutoConfigureTestRestTemplate
class DiscordApiKeyMissingTest {

    @Autowired TestRestTemplate rest;

    @Test
    @DisplayName("키가_설정되지_않으면_헤더가_있든_없든_401")
    void 키가_설정되지_않으면_헤더가_있든_없든_401() {
        assertThat(call(null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(call("").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(call("아무-키").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private org.springframework.http.ResponseEntity<String> call(String apiKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (apiKey != null) {
            headers.set("X-API-Key", apiKey);
        }
        Map<String, Object> body =
                Map.of(
                        "callerDiscordUserId",
                        "1327394882193880001",
                        "discordUserIds",
                        List.of("1327394882193880001"));
        return rest.exchange(
                "/api/discord/studies/1327394882193883136/attendances",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                String.class);
    }
}
