package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AuthDtos.UserView;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 유저 목록 (백오피스 "유저" 탭 — 스터디원/운영진 통합). 인증 필요.
 *  (역할별 접근 가드는 후속 — 현재는 로그인 유저면 조회 가능) */
@RestController
@RequestMapping("/users")
public class UserController {

    private final UserRepository users;

    public UserController(UserRepository users) {
        this.users = users;
    }

    @GetMapping
    public List<UserView> list() {
        return users.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .map(u -> new UserView(u.getId(), u.getEmail(), u.getName(), u.getPicture(),
                        u.getRole().name(), String.valueOf(u.getCreatedAt())))
                .toList();
    }
}
