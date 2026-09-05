package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 유저 목록 (백오피스 "유저" 탭 — 스터디원/운영진 통합). 인증 필요.
 *  (역할별 접근 가드는 후속 — 현재는 로그인 유저면 조회 가능) */
@Tag(name = "유저", description = "백오피스 유저 목록")
@RestController
@RequestMapping("/accounts")
public class AccountController {

    private final AccountRepository accounts;

    public UserController(AccountRepository accounts) {
        this.accounts = users;
    }

    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    public List<AccountView> list() {
        return accounts.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .map(u -> new AccountView(u.getId(), u.getEmail(), u.getNickname(), u.getProfileImgUrl(),
                        u.getSystemRole().name(), String.valueOf(u.getCreatedAt())))
                .toList();
    }
}
