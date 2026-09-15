package com.studyclub.api.config;

import com.studyclub.api.auth.security.AdminGuardInterceptor;
import com.studyclub.api.auth.security.OnboardingGuardInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final OnboardingGuardInterceptor onboardingGuardInterceptor;
    private final AdminGuardInterceptor adminGuardInterceptor;

    public WebConfig(
            OnboardingGuardInterceptor onboardingGuardInterceptor,
            AdminGuardInterceptor adminGuardInterceptor) {
        this.onboardingGuardInterceptor = onboardingGuardInterceptor;
        this.adminGuardInterceptor = adminGuardInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(onboardingGuardInterceptor);
        registry.addInterceptor(adminGuardInterceptor);
    }
}
