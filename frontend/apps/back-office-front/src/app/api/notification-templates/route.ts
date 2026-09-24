// BFF — 알림 템플릿 목록. 백오피스 전용이라 규약대로 `/api/admin` 을 부른다.
import { proxyGet } from '@/lib/bff';

export async function GET() {
  return proxyGet('/api/admin/notification-templates');
}
