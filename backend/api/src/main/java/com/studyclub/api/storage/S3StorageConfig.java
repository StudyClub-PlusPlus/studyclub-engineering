package com.studyclub.api.storage;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3StorageConfig {
    @Bean
    S3Presigner s3Presigner(@Value("${storage.s3.region:ap-northeast-2}") String region) {
        return S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }

    @Bean
    S3StorageProperties s3StorageProperties(
            @Value("${storage.s3.bucket:studyclub-stage}") String bucket,
            @Value("${storage.s3.cdn-base-url:https://d27gz6v6wvae1d.cloudfront.net}")
                    String cdnBaseUrl) {
        return new S3StorageProperties(bucket, URI.create(cdnBaseUrl));
    }

    public record S3StorageProperties(String bucket, URI cdnBaseUrl) {}
}
