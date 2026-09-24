// 유저(스터디원 + 운영진) 목록 타입. 백엔드 AccountView 와 1:1 이다.

export type ApiUser = {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  role: string;
  createdAt: string | null;
};
