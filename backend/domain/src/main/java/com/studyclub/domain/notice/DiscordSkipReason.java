package com.studyclub.domain.notice;

/** 디스코드를 건너뛴 이유. 보내는 사람에게 그대로 보여 준다 — 말없이 건너뛰면 보냈다고 믿는다 (POL-0010). */
public enum DiscordSkipReason {
    /** 봇 주소·키가 설정되어 있지 않다. */
    BOT_NOT_CONFIGURED,
    /** 이 스터디에 디스코드 카테고리·역할이 만들어져 있지 않다. */
    NO_DISCORD_CHANNEL,
    /** 보내는 사람이 디스코드를 연동하지 않았다. 봇은 보내는 사람의 디스코드 계정으로 권한을 본다. */
    SENDER_NOT_LINKED,
    /** 스터디 카테고리 아래에 글을 올릴 텍스트 채널이 없다. */
    NO_TEXT_CHANNEL
}
