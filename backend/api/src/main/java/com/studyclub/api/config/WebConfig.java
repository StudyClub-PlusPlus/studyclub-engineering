package com.studyclub.api.config;

import com.studyclub.api.auth.security.OnboardingGuardInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final OnboardingGuardInterceptor onboardingGuardInterceptor;

    public WebConfig(OnboardingGuardInterceptor onboardingGuardInterceptor) {
        this.onboardingGuardInterceptor = onboardingGuardInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(onboardingGuardInterceptor);
    }
}
