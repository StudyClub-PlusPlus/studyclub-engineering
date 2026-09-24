# Validation Guide

## Table of Contents

- [원칙](#원칙)
- [DTO 검증](#dto-검증)
- [도메인 검증](#도메인-검증)
- [커스텀 검증](#커스텀-검증)

## 원칙

- **신뢰 경계에서 검증** — 외부 입력(API 요청)은 DTO 에서 `@Valid` 로 검증
- **도메인 불변식** — 비즈니스 규칙은 엔티티 메서드 안에서 검증
- 두 계층의 검증은 역할이 다르다: DTO = "형식이 맞는가", 도메인 = "비즈니스 규칙에 맞는가"

## DTO 검증

Jakarta Validation (`spring-boot-starter-validation`) 사용:

```java
public record CreateStudyRequest(
    @NotBlank(message = "스터디 제목은 필수입니다")
    @Size(max = 100, message = "제목은 100자 이내로 입력해주세요")
    String title,

    @Size(max = 500, message = "설명은 500자 이내로 입력해주세요")
    String description,

    @NotNull(message = "최대 인원은 필수입니다")
    @Min(value = 2, message = "최소 2명 이상이어야 합니다")
    @Max(value = 30, message = "최대 30명까지 가능합니다")
    Integer maxMembers
) {}
```

컨트롤러에서 `@Valid` 적용:

```java
@PostMapping("/studies")
public StudyResponse create(@Valid @RequestBody CreateStudyRequest request) {
    // request 는 이미 검증 완료된 상태 (성공 응답에 래퍼를 두지 않는다)
    ...
}
```

검증에 걸리면 `GlobalExceptionHandler` 가 **400 + `errorCode: "INVALID_INPUT"`** 으로 바꾼다.
어느 필드가 왜 틀렸는지는 `errorMessage` 에 담긴다:

```jsonc
{ "errorCode": "INVALID_INPUT", "errorMessage": "maxMembers: 최소 2명 이상이어야 합니다" }
```

> 필드별로 나눠진 맵이 필요해지면(폼 화면에서 인풋마다 표시) 그때 `ErrorResponse` 에 필드를
> 하나 더 얹는다. 지금은 그 화면이 없어서 두지 않았다.

### 자주 쓰는 어노테이션

| 어노테이션 | 용도 |
|-----------|------|
| `@NotNull` | null 불가 |
| `@NotBlank` | null, "", " " 불가 (문자열) |
| `@Size(min, max)` | 길이/크기 제한 |
| `@Min`, `@Max` | 숫자 범위 |
| `@Email` | 이메일 형식 |
| `@Pattern` | 정규식 매칭 |

## 도메인 검증

비즈니스 규칙은 엔티티 내부에서:

```java
// Study.java
public void addMember(Long userId) {
    if (this.status != StudyStatus.RECRUITING) {
        throw new IllegalStateException("모집 중이 아닙니다");
    }
    if (this.members.size() >= this.maxMembers) {
        throw new IllegalStateException("정원 초과");
    }
    this.members.add(new StudyMember(this, userId));
}
```

DTO 검증과 도메인 검증의 차이:

```
POST /studies/123/members  { userId: null }
→ DTO @NotNull 에서 걸림 (400 Bad Request)

POST /studies/123/members  { userId: 5 }
→ DTO 통과 → 도메인에서 "정원 초과" 검증 (409 Conflict)
```

## 커스텀 검증

반복되는 검증 로직은 커스텀 어노테이션으로:

```java
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PhoneValidator.class)
public @interface ValidPhone {
    String message() default "올바른 전화번호 형식이 아닙니다";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

public class PhoneValidator implements ConstraintValidator<ValidPhone, String> {
    private static final Pattern PATTERN = Pattern.compile("^01[016789]-\\d{3,4}-\\d{4}$");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext ctx) {
        return value == null || PATTERN.matcher(value).matches();
    }
}
```

검증 실패 시 응답은 `GlobalExceptionHandler` 에서 처리 → Exception Handling Guide 참고.
