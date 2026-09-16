import http from 'k6/http';
import { check } from 'k6';

export const options = {
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<2000'] },
};
const base = __ENV.BASE_URL || 'http://localhost:8000';
const token = __ENV.ACCESS_TOKEN || '';
export default function () {
  const response = http.get(`${base}/api/v1/runs`, { headers: { Authorization: `Bearer ${token}` } });
  check(response, { 'runs endpoint responds': (r) => [200, 401, 403].includes(r.status) });
}
