import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  scenarios: {
    sustainedIngest: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1m',
      duration: '2m',
      preAllocatedVUs: 40,
      maxVUs: 120,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
const apiKey = __ENV.INGEST_API_KEY || 'local-ingest-key';

export default function () {
  const patientBucket = Math.floor(Math.random() * 200);
  const payload = JSON.stringify({
    patientId: `patient-${patientBucket}`,
    type: 'observation',
    data: { sequence: uuidv4() },
    ts: new Date().toISOString(),
  });
  const response = http.post(`${baseUrl}/events`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'Idempotency-Key': uuidv4(),
    },
  });
  check(response, {
    accepted: (res) => res.status === 202,
  });
}
