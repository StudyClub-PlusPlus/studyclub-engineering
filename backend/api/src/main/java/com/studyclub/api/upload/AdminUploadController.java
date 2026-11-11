package com.studyclub.api.upload;

import com.studyclub.api.auth.security.RequireAdmin;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.storage.StoragePurpose;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 백오피스 이미지 올리기. 온보딩과 무관하게 캡틴({@code SYSTEM_ROLE=ADMIN})이면 쓸 수 있다 — 사용자 사이트 경로({@code
 * /api/uploads/images})는 온보딩 완료를 요구하므로 경로를 분리한다.
 */
@Tag(name = "업로드(어드민)", description = "백오피스 이미지 올리기")
@SecurityRequirement(name = "bearerAuth")
@RequireAdmin
@RestController
@RequestMapping("/api/admin/uploads")
public class AdminUploadController {

    private final UploadService uploadService;

    public AdminUploadController(UploadService uploadService) {
        this.uploadService = uploadService;
    }

    @Operation(summary = "이미지 올리기 — 파일 번호를 받는다")
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public UploadController.UploadResponse uploadImage(
            Authentication authentication,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "purpose", required = false) String purpose)
            throws IOException {
        Long accountId = authenticatedAccountId(authentication);
        StoragePurpose storagePurpose = parsePurpose(purpose);
        byte[] bytes = file == null ? new byte[0] : file.getBytes();
        UploadService.Uploaded uploaded = uploadService.upload(accountId, storagePurpose, bytes);
        return new UploadController.UploadResponse(uploaded.fileId(), uploaded.url());
    }

    private static StoragePurpose parsePurpose(String purpose) {
        if (purpose == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "용도가 올바르지 않습니다.");
        }
        try {
            return StoragePurpose.valueOf(purpose);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "용도가 올바르지 않습니다.");
        }
    }

    private Long authenticatedAccountId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return accountId;
    }
}
