package com.studyclub.api.upload;

import com.studyclub.api.auth.security.RequireOnboarding;
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
 * 공용 이미지 올리기. 파일을 먼저 올려 번호를 받고, 기능 쪽 저장 API(프로필 연결·스터디 등록)가 그 번호를 받아 연결한다 — 스터디 등록 폼처럼 올리는 시점에 붙일
 * 대상이 없는 기능도 같은 길을 쓰기 위해서다 (specs/profile-image/spec.md 결정 1).
 */
@Tag(name = "업로드", description = "이미지 올리기")
@SecurityRequirement(name = "bearerAuth")
@RequireOnboarding
@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    public record UploadResponse(Long fileId, String url) {}

    private final UploadService uploadService;

    public UploadController(UploadService uploadService) {
        this.uploadService = uploadService;
    }

    @Operation(summary = "이미지 올리기 — 파일 번호를 받는다")
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public UploadResponse uploadImage(
            Authentication authentication,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestPart(value = "purpose", required = false) String purposePart,
            @RequestParam(value = "purpose", required = false) String purposeParam)
            throws IOException {
        Long accountId = authenticatedAccountId(authentication);
        String purpose = purposePart != null && !purposePart.isBlank() ? purposePart : purposeParam;
        StoragePurpose storagePurpose = parsePurpose(purpose);
        byte[] bytes = file == null ? new byte[0] : file.getBytes();
        UploadService.Uploaded uploaded = uploadService.upload(accountId, storagePurpose, bytes);
        return new UploadResponse(uploaded.fileId(), uploaded.url());
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
