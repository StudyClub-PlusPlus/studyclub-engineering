package com.studyclub.api.bookmark;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(StudyBookmarkController.class)
class StudyBookmarkControllerTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean StudyBookmarkService studyBookmarkService;

    private Authentication auth;

    @BeforeEach
    void setUp() {
        var token = new UsernamePasswordAuthenticationToken("user@example.com", null, List.of());
        token.setDetails("100");
        auth = token;

        when(studyBookmarkService.getStudyBookmarks(anyLong(), anyInt(), anyInt()))
                .thenReturn(new StudyBookmarkService.Result(
                        new StudyBookmarkResponse(List.of(), 0, 0, 20), HttpStatus.OK));
    }

    @Test
    @DisplayName("실패 - 토큰 없이 조회하면 401을 반환한다")
    void rejectsUnauthenticatedRequest() throws Exception {
        mockMvc.perform(get("/api/me/bookmarks"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("실패 - offset이 음수이면 400을 반환한다")
    void rejectsNegativeOffset() throws Exception {
        mockMvc.perform(get("/api/me/bookmarks?offset=-1").with(authentication(auth)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_INPUT"));
    }

    @Test
    @DisplayName("실패 - limit이 0이면 400을 반환한다")
    void rejectsZeroLimit() throws Exception {
        mockMvc.perform(get("/api/me/bookmarks?limit=0").with(authentication(auth)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_INPUT"));
    }

    @Test
    @DisplayName("실패 - limit이 100 초과이면 400을 반환한다")
    void rejectsLimitExceedingMax() throws Exception {
        mockMvc.perform(get("/api/me/bookmarks?limit=101").with(authentication(auth)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_INPUT"));
    }
}
