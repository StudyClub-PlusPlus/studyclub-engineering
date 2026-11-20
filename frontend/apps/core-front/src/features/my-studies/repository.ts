import { apiMyStudiesSchema } from '@/features/my-studies/response-schema';
import { http } from '@/lib/http';

export function getMyStudies() {
  return http('/api/me/studies', apiMyStudiesSchema);
}
