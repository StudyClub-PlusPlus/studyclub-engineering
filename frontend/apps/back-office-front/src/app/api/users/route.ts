// BFF — 유저 목록. 백엔드 /accounts 를 중계한다.
import { proxyGet } from '@/lib/bff';

export async function GET() {
  return proxyGet('/accounts');
}
