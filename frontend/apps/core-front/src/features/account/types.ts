/** GET /api/me 및 계정 변경 응답. */
export type Account = {
  id: number;
  email: string;
  nickname: string | null;
  picture: string | null;
  role: string;
  createdAt?: string;
  timeZone: string | null;
  onboardingCompletedAt: string | null;
  /** 디스코드 연동 여부(ACCOUNT.DISCORD_ID). GET /api/me 에만 있고, 백엔드 DSC-02 배포 전에는 오지 않는다. */
  discordLinked?: boolean | null;
  /** 연결된 디스코드 username (표시 이름 아님). 미연동이면 null. 숫자 ID 는 내려오지 않는다 */
  discordHandle?: string | null;
};
