package com.studyclub.api.discord;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 디스코드 → 웹 captain · navigator role 알림 (DSC-16). 봇 전용 — X-API-Key (SecurityConfig 의 discordChain).
 *
 * <p>받자마자 204 를 주고 맞추는 일은 뒤에서 한다. 웹이 기준이라 받은 값으로 웹을 바꾸지 않는다 (specs/discord-role-sync/spec.md).
 */
@RestController
@RequestMapping("/api/discord")
public class DiscordRoleSyncController {

    private final DiscordRoleSyncService discordRoleSyncService;

    public DiscordRoleSyncController(DiscordRoleSyncService discordRoleSyncService) {
        this.discordRoleSyncService = discordRoleSyncService;
    }

    @Operation(summary = "디스코드 captain · navigator role 변경 알림 — 웹 기준과 그 사람을 다시 맞춘다")
    @SecurityRequirement(name = "discordApiKey")
    @PostMapping("/role-changes")
    public ResponseEntity<Void> roleChanged(@Valid @RequestBody DiscordRoleChangeRequest request) {
        discordRoleSyncService.onRoleChanged(request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "디스코드 captain · navigator role 명단 (하루 한 번) — 웹 기준과 양쪽으로 맞춘다")
    @SecurityRequirement(name = "discordApiKey")
    @PutMapping("/role-members")
    public ResponseEntity<Void> roleMembers(@Valid @RequestBody DiscordRoleMembersRequest request) {
        discordRoleSyncService.onRoleMembers(request);
        return ResponseEntity.noContent().build();
    }
}
