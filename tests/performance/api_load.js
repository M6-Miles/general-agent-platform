import http from 'k6/http';
import { check } from 'k6';

export const options = {
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1000'] },
};

const base = __ENV.BASE_URL || 'http://localhost:8000';
export default function () {
  const response = http.get(`${base}/health`);
  check(response, { 'health is 200': (r) => r.status === 200 });
}
