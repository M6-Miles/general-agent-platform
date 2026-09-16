import http from 'k6/http';
import {check} from 'k6';

export const options = {vus: 50, duration: '1m', thresholds: {'http_req_failed': ['rate<0.01'], 'http_req_duration': ['p(95)<500']}};
export default function () {
  const response = http.get(`${__ENV.API_URL || 'http://127.0.0.1:8000'}/health`);
  check(response, {'health is 200': (item) => item.status === 200});
}
