// tests/k6/load-test.js - K6 load testing script
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const dashboardLoadTime = new Trend('dashboard_load_time');
const serviceResponseTime = new Trend('service_response_time');

// Test configuration
export const options = {
    stages: [
        { duration: '2m', target: 10 },   // Ramp up
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Spike test
        { duration: '5m', target: 50 },   // Back to normal
        { duration: '2m', target: 0 },    // Ramp down
    ],
    thresholds: {
        errors: ['rate<0.05'],                    // Error rate < 5%
        http_req_duration: ['p(95)<1000'],        // 95% of requests < 1s
        dashboard_load_time: ['p(95)<2000'],      // Dashboard loads < 2s
        service_response_time: ['p(95)<500'],     // Service responses < 500ms
    },
};

const BASE_URL = __ENV.BASE_URL || 'https://7gram.xyz';

// Service endpoints to test
const services = [
    'emby', 'jellyfin', 'plex', 'ai', 'portainer',
    'sonarr', 'radarr', 'home', 'grafana'
];

export default function () {
    group('Dashboard Tests', () => {
        const start = Date.now();
        const res = http.get(BASE_URL);
        dashboardLoadTime.add(Date.now() - start);
        
        check(res, {
            'Dashboard loads successfully': (r) => r.status === 200,
            'Dashboard contains services': (r) => r.body.includes('service-card'),
            'Response time acceptable': (r) => r.timings.duration < 1000,
        }) || errorRate.add(1);
    });

    sleep(1);

    group('Service Proxy Tests', () => {
        const service = services[Math.floor(Math.random() * services.length)];
        const start = Date.now();
        const res = http.get(`${BASE_URL}/${service}`);
        serviceResponseTime.add(Date.now() - start);
        
        check(res, {
            'Service responds': (r) => r.status < 400,
            'Service response time OK': (r) => r.timings.duration < 500,
        }) || errorRate.add(1);
    });

    sleep(Math.random() * 2 + 1);

    group('API Tests', () => {
        const healthRes = http.get(`${BASE_URL}/health`);
        check(healthRes, {
            'Health check passes': (r) => r.status === 200 && JSON.parse(r.body).status === 'healthy',
        }) || errorRate.add(1);
    });

    sleep(Math.random() * 3 + 2);
}

export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'k6-summary.json': JSON.stringify(data),
    };
}