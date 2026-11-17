package com.studyclub.api.feedback;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * User-Agent 원문을 「Chrome 141 · macOS」 처럼 줄인다. 원문은 저장하지 않는다 — 기기 모델명 등 PRD 가 모으지 않기로 한 정보가 들어 있다
 * (specs/feedback/spec.md).
 *
 * <p>규칙은 프로토 {@code describeAgent()} 와 같다. 브라우저는 Edge → Firefox → Chrome → Safari 순으로 본다 — Edge 의
 * UA 에는 Chrome 과 Safari 가, Chrome 의 UA 에는 Safari 가 같이 들어 있기 때문이다. iOS 의 Chrome · Firefox · Edge 는
 * 이름이 따로라 같이 본다. 라이브러리는 들이지 않는다 (AGENT.md 외부 라이브러리 합의).
 */
final class BrowserLabel {

    private static final String UNKNOWN_OS = "기타";

    private static final Browser[] BROWSERS = {
        new Browser("Edge", Pattern.compile("(?:Edg|EdgiOS|EdgA)/(\\d+)")),
        new Browser("Firefox", Pattern.compile("(?:Firefox|FxiOS)/(\\d+)")),
        new Browser("Chrome", Pattern.compile("(?:Chrome|CriOS)/(\\d+)")),
        new Browser("Safari", Pattern.compile("Version/(\\d+).*Safari"))
    };

    private BrowserLabel() {}

    /**
     * @return 「브라우저 버전 · OS」. 헤더가 없거나 브라우저를 모르면 null — 운영 화면은 「—」 로 적는다
     */
    static String describe(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return null;
        }
        for (Browser browser : BROWSERS) {
            Matcher matcher = browser.pattern().matcher(userAgent);
            if (matcher.find()) {
                return browser.name() + " " + matcher.group(1) + " · " + os(userAgent);
            }
        }
        return null;
    }

    private static String os(String userAgent) {
        if (userAgent.contains("iPhone") || userAgent.contains("iPad")) {
            return "iOS";
        }
        if (userAgent.contains("Android")) {
            return "Android";
        }
        if (userAgent.contains("Mac OS X")) {
            return "macOS";
        }
        if (userAgent.contains("Windows")) {
            return "Windows";
        }
        return UNKNOWN_OS;
    }

    private record Browser(String name, Pattern pattern) {}
}
