package com.studyclub.common.error;

/**
 * 에러 응답의 {@code errorCode} 정본.
 *
 * <p>프론트는 <b>사람이 읽는 메시지가 아니라 이 코드로 분기</b>한다. 메시지는 문구가 바뀌고
 * 번역되지만 코드는 계약이다. 새 코드를 추가할 때는 프론트가 실제로 분기할 이유가 있을 때만
 * 추가한다 — 코드가 늘어나면 프론트의 switch 도 같이 늘어난다.
 *
 * <p>HTTP 상태는 여기서 한 번만 정한다. 컨트롤러/서비스는 상태 코드를 신경 쓰지 않고
 * {@link BusinessException} 에 ErrorCode 만 넘긴다.
 */
public enum ErrorCode {

    /** 요청 형식·검증 실패 (@Valid, 필수 파라미터 누락 등) */
    INVALID_INPUT(400, "입력값이 올바르지 않습니다."),
    /** 인증 없음 / 토큰 무효·만료 */
    UNAUTHORIZED(401, "인증이 필요합니다."),
    /** 인증은 됐으나 권한 없음 */
    FORBIDDEN(403, "권한이 없습니다."),
    /** 리소스 없음 */
    NOT_FOUND(404, "요청한 리소스를 찾을 수 없습니다."),
    /** 비즈니스 규칙 위반 (중복, 마감된 스터디에 신청 등) */
    CONFLICT(409, "요청을 처리할 수 없는 상태입니다."),
    /** 외부 연동 실패 (구글 OAuth 미설정 등) */
    EXTERNAL_SERVICE_ERROR(503, "외부 서비스와 통신하지 못했습니다."),
    /** 예상하지 못한 서버 오류. 내부 사정은 절대 메시지에 담지 않는다 */
    INTERNAL_ERROR(500, "서버 오류가 발생했습니다.");

    private final int status;
    private final String defaultMessage;

    ErrorCode(int status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public int status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }

    /**
     * 프레임워크가 던진 예외(HTTP 상태만 아는 것)를 우리 코드로 되돌린다.
     * 매핑되는 코드가 없으면 4xx 는 {@link #INVALID_INPUT}, 그 외는 {@link #INTERNAL_ERROR}.
     */
    public static ErrorCode fromStatus(int status) {
        for (ErrorCode code : values()) {
            if (code.status == status) {
                return code;
            }
        }
        return status >= 400 && status < 500 ? INVALID_INPUT : INTERNAL_ERROR;
    }
}
