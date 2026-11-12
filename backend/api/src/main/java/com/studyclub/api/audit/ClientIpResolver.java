package com.studyclub.api.audit;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** 명시적으로 신뢰하는 프록시의 전달 주소만 사용한다. 일반 요청 헤더는 신뢰하지 않는다. */
@Component
public class ClientIpResolver {
    private final List<IpAddressMatcher> trustedProxies;

    public ClientIpResolver(@Value("${audit.trusted-proxies:}") String proxies) {
        trustedProxies =
                Arrays.stream(proxies.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(IpAddressMatcher::new)
                        .toList();
    }

    public String currentIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            return resolve(attrs.getRequest());
        }
        return null;
    }

    String resolve(HttpServletRequest request) {
        String peer = literal(request.getRemoteAddr());
        if (peer == null || !trusted(peer)) {
            return peer;
        }
        // 여러 동일 이름 헤더도 순서를 보존한다. 지나치게 긴/잘못된 체인은 전부 무시한다.
        var headers = request.getHeaders("X-Forwarded-For");
        StringBuilder forwarded = new StringBuilder();
        while (headers != null && headers.hasMoreElements()) {
            if (!forwarded.isEmpty()) forwarded.append(',');
            forwarded.append(headers.nextElement());
            if (forwarded.length() > 2048) return peer;
        }
        if (forwarded.isEmpty()) return peer;
        String[] chain = forwarded.toString().split(",", -1);
        if (chain.length > 32) return peer;
        for (int i = 0; i < chain.length; i++) {
            chain[i] = literal(chain[i].trim());
            if (chain[i] == null) return peer;
        }
        String address = peer;
        for (int i = chain.length - 1; i >= 0 && trusted(address); i--) {
            address = chain[i];
        }
        return address;
    }

    private boolean trusted(String address) {
        return trustedProxies.stream().anyMatch(proxy -> proxy.matches(address));
    }

    private static String literal(String value) {
        if (value == null || value.length() > 45) return null;
        if (value.contains(":")) {
            if (!value.matches("[0-9a-fA-F:.]+")) return null;
        } else if (!value.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) {
            return null;
        }
        try {
            return InetAddress.getByName(value).getHostAddress();
        } catch (UnknownHostException e) {
            return null;
        }
    }
}
