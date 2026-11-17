package com.studyclub.api.audit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ClientIpResolverTest {
    @Test
    @DisplayName("신뢰하지 않는 직접 접속자의 위조 전달 헤더를 무시한다")
    void ignoresSpoofedHeader() {
        assertThat(resolve("", "192.0.2.10", "198.51.100.20")).isEqualTo("192.0.2.10");
    }

    @Test
    @DisplayName("오른쪽부터 신뢰 프록시를 제외하여 첫 외부 주소를 선택한다")
    void trustedChainStopsBeforeSpoofedPrefix() {
        assertThat(resolve("192.0.2.0/24", "192.0.2.10", "203.0.113.99, 198.51.100.20, 192.0.2.11"))
                .isEqualTo("198.51.100.20");
    }

    @Test
    @DisplayName("잘못된 주소·호스트 이름·빈 체인·지나치게 긴 헤더는 직접 접속 주소로 대체한다")
    void rejectsMalformedChains() {
        for (String header :
                new String[] {
                    "localhost", "127.1", "999.0.0.1", "198.51.100.2,", "1".repeat(2049)
                }) {
            assertThat(resolve("192.0.2.0/24", "192.0.2.10", header)).isEqualTo("192.0.2.10");
        }
    }

    @Test
    @DisplayName("IPv6 접속과 여러 전달 헤더도 지원한다")
    void ipv6AndRepeatedHeaders() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("2001:db8::1");
        request.addHeader("X-Forwarded-For", "198.51.100.2");
        request.addHeader("X-Forwarded-For", "2001:db8::2");
        assertThat(new ClientIpResolver("2001:db8::/32").resolve(request))
                .isEqualTo("198.51.100.2");
        assertThat(new ClientIpResolver("").currentIp()).isNull();
    }

    private String resolve(String trusted, String peer, String forwarded) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(peer);
        request.addHeader("X-Forwarded-For", forwarded);
        return new ClientIpResolver(trusted).resolve(request);
    }
}
