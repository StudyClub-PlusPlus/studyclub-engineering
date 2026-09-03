package com.studyclub.api.config;

import java.util.Locale;
import org.hibernate.boot.model.naming.Identifier;
import org.hibernate.engine.jdbc.env.spi.JdbcEnvironment;
import org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy;

/**
 * <b>테이블 이름은 대문자, 컬럼은 소문자 snake_case.</b>
 *
 * <p>규칙을 코드로 강제한다. 리뷰에서 잡는 규칙은 언젠가 새고, 새면 MySQL 이
 * (리눅스에서는 테이블 이름이 대소문자를 구분하므로) <b>대소문자만 다른 쌍둥이 테이블</b>을
 * 조용히 만들어 준다. 그때는 데이터가 양쪽에 갈라져 있어 되돌리기가 비싸다.
 *
 * <p>Spring Boot 가 기본으로 켜는 전략({@link CamelCaseToUnderscoresNamingStrategy})은 이름을 전부 소문자로
 * 내린다. 여기서는 <b>테이블 이름만</b> 대문자로 되돌리고 컬럼 규칙(camelCase → snake_case)은
 * 그대로 물려받는다 — 컬럼까지 손대면 {@code @Column} 이 없는 필드가 조용히 다른 이름이 된다.
 */
public class UpperCaseTableNamingStrategy extends CamelCaseToUnderscoresNamingStrategy {

    @Override
    public Identifier toPhysicalTableName(Identifier name, JdbcEnvironment jdbcEnvironment) {
        Identifier snake = super.toPhysicalTableName(name, jdbcEnvironment);
        if (snake == null) {
            return null;
        }
        return Identifier.toIdentifier(snake.getText().toUpperCase(Locale.ROOT), snake.isQuoted());
    }

    @Override
    public Identifier toPhysicalColumnName(Identifier name, JdbcEnvironment jdbcEnvironment) {
        Identifier snake = super.toPhysicalColumnName(name, jdbcEnvironment);
        if (snake == null) {
            return null;
        }
        return Identifier.toIdentifier(snake.getText().toUpperCase(Locale.ROOT), snake.isQuoted());
    }
}
