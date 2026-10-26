package com.studyclub.api.discord;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * 백엔드 → 디스코드 봇(FastAPI) 호출. 계약은 docs/discord-development-guide/api/ — 엔드포인트마다 문서 하나.
 *
 * <p>API 키는 봇 → 백엔드 방향과 같은 {@code discord.api-key} 다 (봇 계약이 양방향 같은 값으로 정했다). 주소·키 둘 중 하나라도 비어 있으면
 * {@link #isConfigured()} 가 false 이고, 호출하지 않는다.
 *
 * <p>{@code requesterId} 는 {@code X-Discord-User-ID} 로 나가는 요청자의 디스코드 유저 ID 다. 사람 대신 백엔드가 부르면 시스템
 * 아이디({@link #systemUserId()})를 넘긴다 (common-header.md). 봇은 이 ID 로 권한을 보지 않고 메시지의 발신자 줄에만 쓴다 — 누가 시킬
 * 수 있는지는 호출하는 쪽이 먼저 확인한다.
 *
 * <p>재시도하지 않는다. 봇이 거절하거나 닿지 않으면 {@link ErrorCode#EXTERNAL_SERVICE_ERROR} 로 던진다.
 */
@Component
public class DiscordBotClient {

    private static final Logger log = LoggerFactory.getLogger(DiscordBotClient.class);
    private static final Pattern SNOWFLAKE = Pattern.compile(DiscordAttendanceRequest.SNOWFLAKE);

    private final String botUrl;
    private final String apiKey;
    private final String botId;
    private final RestClient restClient;

    public DiscordBotClient(
            @Value("${discord.bot-url:}") String botUrl,
            @Value("${discord.api-key:}") String apiKey,
            @Value("${discord.bot-id:}") String botId) {
        this.botUrl = botUrl;
        this.apiKey = apiKey;
        this.botId = botId;
        // 봇은 429 를 내부에서 기다리므로 느려질 뿐 실패하지 않는다 — 읽기 타임아웃을 넉넉히 잡는다
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(30));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    public boolean isConfigured() {
        return StringUtils.hasText(botUrl) && StringUtils.hasText(apiKey);
    }

    /** 시스템 아이디로 부를 수 있는가 — {@code DISCORD_BOT_ID} 가 설정돼 있다. */
    public boolean canCallAsSystem() {
        return botId != null && !botId.isBlank();
    }

    /**
     * 사람 대신 백엔드가 부를 때의 {@code requesterId}(시스템 아이디). 봇 자신의 유저 ID 인 {@code DISCORD_BOT_ID} 다. 비어 있으면
     * 던진다 — 봇은 health 를 뺀 모든 요청에 이 헤더를 요구한다.
     */
    public String systemUserId() {
        if (!StringUtils.hasText(botId)) {
            throw new BusinessException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR, "디스코드 봇 ID 가 설정되지 않았습니다 (DISCORD_BOT_ID).");
        }
        return botId;
    }

    /**
     * 카테고리·채널·역할을 만든다. 재시도하지 않는다 — 봇은 같은 이름의 두 번째 요청에 409 를 주므로 재시도로는 ID 를 받을 수 없다.
     *
     * @param discordUserId 스터디를 만든 캡틴의 디스코드 유저 ID. 봇은 형식만 검사하고 쓰지 않는다
     */
    public CreatedStudy createStudy(String studyName, String discordUserId) {
        String idempotencyKey = UUID.randomUUID().toString();
        CreatedStudy created =
                execute(
                        "create-study",
                        "스터디 생성",
                        idempotencyKey,
                        () -> {
                            try {
                                return request(
                                                HttpMethod.POST,
                                                discordUserId,
                                                idempotencyKey,
                                                "/api/v1/studies")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .body(Map.of("studyName", studyName))
                                        .retrieve()
                                        .body(CreatedStudy.class);
                            } catch (HttpClientErrorException.Conflict e) {
                                String detail = e.getResponseBodyAsString();
                                log.warn("create-study {}: 봇 409 {}", idempotencyKey, detail);
                                // 봇의 409 는 이름 중복만이 아니다 — 길드 설정이 없어도 409 다 (detail 로 구분,
                                // create-study.md). 설정 문제에 "이름을 바꾸라" 고 안내하면 고칠 수 없는 걸 고치라는 말이 된다
                                if (!detail.contains("with this name")) {
                                    throw new BusinessException(
                                            ErrorCode.EXTERNAL_SERVICE_ERROR,
                                            "디스코드 봇 설정 문제로 스터디를 만들지 못했습니다 (409).");
                                }
                                throw new BusinessException(
                                        ErrorCode.CONFLICT,
                                        "디스코드에 같은 이름의 스터디가 이미 있습니다. studyName 을 바꿔 다시 요청하세요.");
                            }
                        });

        if (created == null
                || !isSnowflake(created.discordStudyId())
                || !isSnowflake(created.discordRoleId())) {
            log.error("create-study {}: 봇 응답의 ID 가 snowflake 가 아니다 {}", idempotencyKey, created);
            throw invalidResponse();
        }
        return created;
    }

    /**
     * 스터디 카테고리 바로 아래의 텍스트·음성 채널을 사이드바 순서로. 봇이 모르는 타입 값({@code FORUM} · {@code STAGE} 등)을 돌려주면 건너뛴다
     * (get-study-channels.md#성공-응답). 목록은 요청 시점의 스냅샷이라 오래 캐시하지 않는다.
     */
    public List<StudyChannel> getStudyChannels(String requesterId, String discordStudyId) {
        String requestId = UUID.randomUUID().toString();
        BotStudyChannel[] channels =
                execute(
                        "get-study-channels",
                        "채널 조회",
                        requestId,
                        () ->
                                request(
                                                HttpMethod.GET,
                                                requesterId,
                                                null,
                                                "/api/v1/studies/{discordStudyId}/channels",
                                                discordStudyId)
                                        .retrieve()
                                        .body(BotStudyChannel[].class));
        if (channels == null) {
            log.error("get-study-channels {}: 봇 응답 바디가 없다", requestId);
            throw invalidResponse();
        }

        List<StudyChannel> result = new ArrayList<>();
        for (BotStudyChannel channel : channels) {
            if (channel == null || !isSnowflake(channel.discordChannelId())) {
                log.error(
                        "get-study-channels {}: 봇 응답의 채널 ID 가 snowflake 가 아니다 {}",
                        requestId,
                        channel);
                throw invalidResponse();
            }
            ChannelType type = ChannelType.from(channel.discordChannelType());
            if (type == null) {
                log.debug(
                        "get-study-channels {}: 모르는 채널 타입 {} 건너뜀",
                        requestId,
                        channel.discordChannelType());
                continue;
            }
            result.add(
                    new StudyChannel(
                            channel.discordChannelId(), channel.discordChannelName(), type));
        }
        return result;
    }

    /**
     * 스터디 역할을 붙인다. captain · navigator 역할은 안 된다 (navigator 는 {@link #assignNavigatorRole}). 멱등이다.
     */
    public RoleChangeResult assignRole(
            String requesterId,
            String discordRoleId,
            String discordStudyId,
            List<String> discordUserIds) {
        return changeRole(
                "assign-role",
                "역할 배정",
                HttpMethod.POST,
                requesterId,
                discordStudyId,
                discordUserIds,
                "/api/v1/roles/{discordRoleId}/users",
                discordRoleId);
    }

    /** 스터디 역할을 뗀다. 길드에 없는 유저는 성공으로 센다. 멱등이다. */
    public RoleChangeResult removeRole(
            String requesterId,
            String discordRoleId,
            String discordStudyId,
            List<String> discordUserIds) {
        return changeRole(
                "remove-role",
                "역할 회수",
                HttpMethod.DELETE,
                requesterId,
                discordStudyId,
                discordUserIds,
                "/api/v1/roles/{discordRoleId}/users",
                discordRoleId);
    }

    /** navigator 역할을 붙인다. 시스템 아이디로도 부를 수 있다. */
    public RoleChangeResult assignNavigatorRole(
            String requesterId, String discordStudyId, List<String> discordUserIds) {
        return changeRole(
                "assign-navigator-role",
                "navigator 역할 배정",
                HttpMethod.POST,
                requesterId,
                discordStudyId,
                discordUserIds,
                "/api/v1/roles/navigator/users");
    }

    /**
     * navigator 역할을 뗀다. 시스템 아이디로도 부를 수 있다. navigator 역할은 길드 전체에 하나라, 유저가 <b>남은 어떤 스터디에서도</b>
     * navigator 가 아닐 때만 부른다.
     */
    public RoleChangeResult removeNavigatorRole(
            String requesterId, String discordStudyId, List<String> discordUserIds) {
        return changeRole(
                "remove-navigator-role",
                "navigator 역할 회수",
                HttpMethod.DELETE,
                requesterId,
                discordStudyId,
                discordUserIds,
                "/api/v1/roles/navigator/users");
    }

    /**
     * 스터디 텍스트 채널에 올린다. 채널이 {@code discordStudyId} 카테고리 바로 아래인지만 봇이 보므로, 스터디에 맞는 쌍을 보내는 건 호출하는 쪽
     * 책임이다. 중복 전송은 막지 않는다.
     *
     * @param mentionUserIds 알림을 울릴 유저. 빈 리스트면 멘션 없이 올린다
     */
    public void sendMessage(
            String requesterId,
            String discordChannelId,
            String discordStudyId,
            String msg,
            List<String> mentionUserIds) {
        String idempotencyKey = UUID.randomUUID().toString();
        execute(
                "send-message",
                "메시지 전송",
                idempotencyKey,
                () ->
                        request(
                                        HttpMethod.POST,
                                        requesterId,
                                        idempotencyKey,
                                        "/api/v1/channels/{discordChannelId}/msg",
                                        discordChannelId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .body(
                                        Map.of(
                                                "discordStudyId",
                                                discordStudyId,
                                                "msg",
                                                msg,
                                                "discordUserIds",
                                                mentionUserIds))
                                .retrieve()
                                .toBodilessEntity());
    }

    /** alert 채널에 운영 알림을 올린다. 멘션은 알림을 울리지 않는다. */
    public void sendAlertMessage(String requesterId, String msg) {
        sendFixedChannelMessage(
                "send-alert-message", "alert 전송", requesterId, "/api/v1/channels/alert/msg", msg);
    }

    /** announcement 채널에 {@code @everyone} 공지를 올린다. 누가 올릴 수 있는지는 호출하는 쪽이 정한다. */
    public void sendAnnouncementMessage(String requesterId, String msg) {
        sendFixedChannelMessage(
                "send-announcement-message",
                "공지 전송",
                requesterId,
                "/api/v1/channels/announcement/msg",
                msg);
    }

    private RoleChangeResult changeRole(
            String op,
            String action,
            HttpMethod method,
            String requesterId,
            String discordStudyId,
            List<String> discordUserIds,
            String path,
            Object... uriVariables) {
        String idempotencyKey = UUID.randomUUID().toString();
        RoleChangeResult result =
                execute(
                        op,
                        action,
                        idempotencyKey,
                        () ->
                                request(method, requesterId, idempotencyKey, path, uriVariables)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .body(
                                                Map.of(
                                                        "discordStudyId",
                                                        discordStudyId,
                                                        "discordUserIds",
                                                        discordUserIds))
                                        .retrieve()
                                        .body(RoleChangeResult.class));
        if (result == null || result.failed() == null) {
            log.error("{} {}: 봇 응답이 올바르지 않다 {}", op, idempotencyKey, result);
            throw invalidResponse();
        }
        return result;
    }

    private void sendFixedChannelMessage(
            String op, String action, String requesterId, String path, String msg) {
        String idempotencyKey = UUID.randomUUID().toString();
        execute(
                op,
                action,
                idempotencyKey,
                () ->
                        request(HttpMethod.POST, requesterId, idempotencyKey, path)
                                .contentType(MediaType.APPLICATION_JSON)
                                .body(Map.of("msg", msg))
                                .retrieve()
                                .toBodilessEntity());
    }

    /** 공통 헤더를 붙인다. {@code idempotencyKey} 가 null 이면(조회) 싣지 않는다 (common-header.md). */
    private RestClient.RequestBodySpec request(
            HttpMethod method,
            String requesterId,
            String idempotencyKey,
            String path,
            Object... uriVariables) {
        RestClient.RequestBodySpec spec =
                restClient
                        .method(method)
                        .uri(botUrl + path, uriVariables)
                        .header("X-API-Key", apiKey)
                        .header("X-Discord-User-ID", requesterId);
        if (idempotencyKey != null) {
            spec.header("Idempotency-Key", idempotencyKey);
        }
        return spec;
    }

    /**
     * 설정을 확인하고 호출한 뒤, 실패를 {@link BusinessException} 으로 바꾼다. {@code call} 이 던진 {@link
     * BusinessException} 은 그대로 나간다.
     *
     * @param op 로그용 엔드포인트 이름 (문서 파일 이름)
     * @param action 에러 메시지에 실을 한글 이름
     * @param requestId 로그로 시도를 묶는 ID. 상태를 바꾸는 요청이면 {@code Idempotency-Key} 와 같은 값이다
     */
    private <T> T execute(String op, String action, String requestId, Supplier<T> call) {
        if (!isConfigured()) {
            throw new BusinessException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "디스코드 봇이 설정되지 않았습니다 (DISCORD_BOT_URL/DISCORD_API_KEY).");
        }
        try {
            return call.get();
        } catch (RestClientResponseException e) {
            // 봇 detail 에는 길드·역할 ID 같은 봇 내부 사정이 들어 있다. 응답에는 싣지 않고 로그에만 남긴다
            log.warn(
                    "{} {}: 봇 {} {}",
                    op,
                    requestId,
                    e.getStatusCode().value(),
                    e.getResponseBodyAsString());
            throw new BusinessException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "디스코드 봇이 " + action + " 요청을 거절했습니다 (" + e.getStatusCode().value() + ").");
        } catch (RestClientException e) {
            log.warn("{} {}: 봇 호출 실패 {}", op, requestId, e.getMessage());
            throw new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "디스코드 봇과 통신하지 못했습니다.");
        } catch (IllegalArgumentException e) {
            // 헤더 값이 잘못되면(키 끝의 개행 등) JDK 가 값을 통째로 메시지에 실어 던진다. 메시지를 버려야 키가 로그에 남지 않는다
            log.warn("{} {}: 요청을 만들지 못했다 ({})", op, requestId, e.getClass().getName());
            throw new BusinessException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "디스코드 봇 요청을 만들지 못했습니다 (DISCORD_API_KEY 형식 확인).");
        }
    }

    private static BusinessException invalidResponse() {
        return new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "디스코드 봇 응답이 올바르지 않습니다.");
    }

    private static boolean isSnowflake(String value) {
        return value != null && SNOWFLAKE.matcher(value).matches();
    }

    public record CreatedStudy(String discordStudyId, String discordRoleId) {}

    public record StudyChannel(
            String discordChannelId, String discordChannelName, ChannelType discordChannelType) {}

    /** {@code send-message} 에 쓸 수 있는 건 {@link #TEXT} 뿐이다. */
    public enum ChannelType {
        TEXT,
        VOICE;

        /** 모르는 값이면 null — 봇이 예약 값을 돌려주기 시작해도 깨지지 않게 enum 으로 바로 역직렬화하지 않는다. */
        static ChannelType from(String value) {
            return Arrays.stream(values())
                    .filter(type -> type.name().equals(value))
                    .findFirst()
                    .orElse(null);
        }
    }

    /**
     * @param succeededCount 지금 원하는 상태(붙이기면 가짐, 떼기면 안 가짐)인 요청 유저 수
     * @param failed 그렇게 만들지 못한 유저. 비어 있으면 전부 성공
     */
    public record RoleChangeResult(int succeededCount, List<FailedUser> failed) {}

    /**
     * @param reason {@code NOT_IN_GUILD}(붙이기만) · {@code DISCORD_REJECTED}
     */
    public record FailedUser(String discordUserId, String reason) {}

    /** 봇 응답 그대로. 타입은 문자열로 받아 {@link ChannelType} 으로 거른다. */
    private record BotStudyChannel(
            String discordChannelId, String discordChannelName, String discordChannelType) {}
}
