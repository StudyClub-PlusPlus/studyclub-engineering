package com.studyclub.api.config;

import com.studyclub.api.auth.security.AdminGuardInterceptor;
import com.studyclub.api.auth.security.CaptainOrNavigatorGuardInterceptor;
import com.studyclub.api.auth.security.GroupRosterGuardInterceptor;
import com.studyclub.api.auth.security.OnboardingGuardInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final OnboardingGuardInterceptor onboardingGuardInterceptor;
    private final AdminGuardInterceptor adminGuardInterceptor;
    private final CaptainOrNavigatorGuardInterceptor captainOrNavigatorGuardInterceptor;
    private final GroupRosterGuardInterceptor groupRosterGuardInterceptor;

    public WebConfig(
            OnboardingGuardInterceptor onboardingGuardInterceptor,
            AdminGuardInterceptor adminGuardInterceptor,
            CaptainOrNavigatorGuardInterceptor captainOrNavigatorGuardInterceptor,
            GroupRosterGuardInterceptor groupRosterGuardInterceptor) {
        this.onboardingGuardInterceptor = onboardingGuardInterceptor;
        this.adminGuardInterceptor = adminGuardInterceptor;
        this.captainOrNavigatorGuardInterceptor = captainOrNavigatorGuardInterceptor;
        this.groupRosterGuardInterceptor = groupRosterGuardInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(onboardingGuardInterceptor);
        registry.addInterceptor(adminGuardInterceptor);
        registry.addInterceptor(captainOrNavigatorGuardInterceptor);
        registry.addInterceptor(groupRosterGuardInterceptor);
    }
}
