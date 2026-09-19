package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.NicknameDtos.AvailabilityResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 로그인 후 온보딩 중에도 사용한다. 가입 완료를 요구하는 가드를 붙이지 않는다. */
@Tag(name = "닉네임", description = "닉네임 사용 가능 여부 조회")
@RestController
@RequestMapping("/api/nicknames")
public class NicknameController {

    private final NicknameAvailabilityService nicknameAvailabilityService;

    public NicknameController(NicknameAvailabilityService nicknameAvailabilityService) {
        this.nicknameAvailabilityService = nicknameAvailabilityService;
    }

    @Operation(
            summary = "닉네임 사용 가능 여부",
            description = "온보딩 미완료 사용자도 조회 가능. 이름을 예약하지 않으며 가입 완료 시 다시 검사합니다.")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/availability")
    public AvailabilityResponse availability(
            @Parameter(description = "검사할 닉네임", example = "Journey") @RequestParam("value")
                    String value) {
        return new AvailabilityResponse(nicknameAvailabilityService.isAvailable(value));
    }
}
