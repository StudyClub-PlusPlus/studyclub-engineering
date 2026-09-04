package com.studyclub.api.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 스펙의 전역 설정. 개별 컨트롤러에는 어노테이션을 달지 않는 것이 기본이다 —
 * 경로·메서드·DTO 는 springdoc 이 코드에서 그대로 읽어가고, 코드에서 읽을 수 없는 것만 여기서 채운다.
 *
 * <p>인증이 필요한 엔드포인트에만 메서드에 {@code @SecurityRequirement(name = "bearerAuth")} 를 단다
 * (전역으로 걸면 공개 엔드포인트까지 자물쇠가 붙어 문서가 거짓말을 한다).
 */
@Configuration
@OpenAPIDefinition(info = @Info(
        title = "StudyClub++ API",
        version = "v1",
        description = """
                성공 응답에는 래퍼가 없다 — payload 를 그대로 돌려준다.
                실패는 어디서 나든 `{errorCode, errorMessage}` 한 모양이고, 프론트는 `errorCode` 로 분기한다."""))
@SecurityScheme(name = "bearerAuth", type = SecuritySchemeType.HTTP, scheme = "bearer", bearerFormat = "JWT")
public class OpenApiConfig {

    /**
     * 에러 응답은 모든 엔드포인트가 같은 모양이므로 전역으로 한 번만 붙인다.
     * ponytail: 엔드포인트마다 {@code @ApiResponse} 를 다는 대신 커스터마이저 하나.
     * 특정 엔드포인트만 다른 에러 스키마를 쓰게 되면 그때 해당 메서드에 어노테이션으로 덮어쓴다.
     */
    @Bean
    public OpenApiCustomizer errorResponseCustomizer() {
        Schema<?> errorSchema = new ObjectSchema()
                .addProperty("errorCode", new StringSchema().example("UNAUTHORIZED"))
                .addProperty("errorMessage", new StringSchema().example("인증이 필요합니다."));

        Content content = new Content().addMediaType(
                org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
                new MediaType().schema(new Schema<>().$ref("#/components/schemas/ErrorResponse")));

        return openApi -> {
            if (openApi.getComponents() == null) {
                openApi.setComponents(new Components());
            }
            openApi.getComponents().addSchemas("ErrorResponse", errorSchema);
            openApi.getPaths().values().forEach(path -> path.readOperations().forEach(op ->
                    op.getResponses().addApiResponse("4XX", new ApiResponse()
                            .description("에러 — HTTP 상태가 아니라 errorCode 로 분기한다")
                            .content(content))));
        };
    }
}
