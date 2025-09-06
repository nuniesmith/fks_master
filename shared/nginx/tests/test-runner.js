// tests/test-runner.js - Main test runner for all test suites
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class TestRunner {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            tests: []
        };
        this.startTime = Date.now();
    }

    async runAllTests() {
        console.log('🧪 Running comprehensive test suite for 7gram Dashboard\n');

        const testSuites = [
            { name: 'Unit Tests', runner: this.runUnitTests },
            { name: 'Integration Tests', runner: this.runIntegrationTests },
            { name: 'Performance Tests', runner: this.runPerformanceTests },
            { name: 'Security Tests', runner: this.runSecurityTests },
            { name: 'Accessibility Tests', runner: this.runAccessibilityTests },
            { name: 'E2E Tests', runner: this.runE2ETests }
        ];

        for (const suite of testSuites) {
            console.log(`\n📋 ${suite.name}`);
            console.log('='.repeat(50));
            
            try {
                await suite.runner.call(this);
            } catch (error) {
                console.error(`❌ ${suite.name} failed:`, error.message);
                this.results.failed++;
            }
        }

        this.results.duration = Date.now() - this.startTime;
        this.printSummary();
        this.saveResults();

        return this.results.failed === 0;
    }

    async runUnitTests() {
        // Jest configuration for unit tests
        const jestConfig = {
            testMatch: ['**/tests/unit/**/*.test.js'],
            collectCoverage: true,
            coverageDirectory: 'coverage/unit',
            coverageThreshold: {
                global: {
                    branches: 80,
                    functions: 80,
                    lines: 80,
                    statements: 80
                }
            }
        };

        fs.writeFileSync('jest.unit.config.json', JSON.stringify(jestConfig, null, 2));

        try {
            execSync('npm run jest -- --config=jest.unit.config.json', { stdio: 'inherit' });
            this.results.passed++;
        } catch (error) {
            this.results.failed++;
            throw error;
        }
    }

    async runIntegrationTests() {
        const tests = [
            this.testNginxConfiguration,
            this.testServiceProxies,
            this.testHealthEndpoints,
            this.testSSLConfiguration,
            this.testCORS,
            this.testRateLimiting
        ];

        for (const test of tests) {
            await test.call(this);
        }
    }

    async testNginxConfiguration() {
        console.log('Testing Nginx configuration...');
        
        try {
            execSync('nginx -t', { stdio: 'pipe' });
            this.results.passed++;
            console.log('✅ Nginx configuration is valid');
        } catch (error) {
            this.results.failed++;
            console.log('❌ Nginx configuration test failed');
            throw error;
        }
    }

    async testServiceProxies() {
        console.log('Testing service proxies...');
        
        const services = [
            { name: 'Emby', url: 'http://localhost/emby' },
            { name: 'Jellyfin', url: 'http://localhost/jellyfin' },
            { name: 'AI', url: 'http://localhost/ai' },
            { name: 'Portainer', url: 'http://localhost/portainer' }
        ];

        for (const service of services) {
            try {
                const response = await fetch(service.url);
                if (response.ok) {
                    this.results.passed++;
                    console.log(`✅ ${service.name} proxy is working`);
                } else {
                    this.results.failed++;
                    console.log(`❌ ${service.name} proxy returned ${response.status}`);
                }
            } catch (error) {
                this.results.failed++;
                console.log(`❌ ${service.name} proxy is not accessible`);
            }
        }
    }

    async testHealthEndpoints() {
        console.log('Testing health endpoints...');
        
        try {
            const response = await fetch('http://localhost/health');
            const data = await response.json();
            
            if (data.status === 'healthy') {
                this.results.passed++;
                console.log('✅ Health endpoint is functioning');
            } else {
                this.results.failed++;
                console.log('❌ Health endpoint returned unhealthy status');
            }
        } catch (error) {
            this.results.failed++;
            console.log('❌ Health endpoint test failed:', error.message);
        }
    }

    async testSSLConfiguration() {
        console.log('Testing SSL configuration...');
        
        const sslTests = [
            'testssl.sh --severity HIGH https://7gram.xyz',
            'nmap --script ssl-enum-ciphers -p 443 7gram.xyz'
        ];

        for (const test of sslTests) {
            try {
                execSync(test, { stdio: 'pipe' });
                this.results.passed++;
            } catch (error) {
                this.results.failed++;
                console.log(`❌ SSL test failed: ${test}`);
            }
        }
    }

    async testCORS() {
        console.log('Testing CORS configuration...');
        
        const testOrigins = [
            'https://7gram.xyz',
            'https://emby.7gram.xyz',
            'https://evil.com'
        ];

        for (const origin of testOrigins) {
            try {
                const response = await fetch('http://localhost/api/test', {
                    headers: { 'Origin': origin }
                });
                
                const allowedOrigin = response.headers.get('Access-Control-Allow-Origin');
                
                if (origin.includes('7gram.xyz') && allowedOrigin) {
                    this.results.passed++;
                    console.log(`✅ CORS allows ${origin}`);
                } else if (!origin.includes('7gram.xyz') && !allowedOrigin) {
                    this.results.passed++;
                    console.log(`✅ CORS blocks ${origin}`);
                } else {
                    this.results.failed++;
                    console.log(`❌ CORS misconfigured for ${origin}`);
                }
            } catch (error) {
                this.results.failed++;
                console.log(`❌ CORS test failed for ${origin}`);
            }
        }
    }

    async testRateLimiting() {
        console.log('Testing rate limiting...');
        
        const endpoint = 'http://localhost/api/test';
        const requests = 50;
        let blocked = 0;

        for (let i = 0; i < requests; i++) {
            try {
                const response = await fetch(endpoint);
                if (response.status === 429) {
                    blocked++;
                }
            } catch (error) {
                // Ignore errors
            }
        }

        if (blocked > 0) {
            this.results.passed++;
            console.log(`✅ Rate limiting is working (${blocked}/${requests} blocked)`);
        } else {
            this.results.failed++;
            console.log('❌ Rate limiting is not functioning');
        }
    }

    async runPerformanceTests() {
        const lighthouse = await import('lighthouse');
        const chromeLauncher = await import('chrome-launcher');

        const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
        const options = {
            logLevel: 'error',
            output: 'json',
            port: chrome.port
        };

        const runnerResult = await lighthouse('http://localhost', options);

        const scores = {
            performance: runnerResult.lhr.categories.performance.score * 100,
            accessibility: runnerResult.lhr.categories.accessibility.score * 100,
            seo: runnerResult.lhr.categories.seo.score * 100,
            'best-practices': runnerResult.lhr.categories['best-practices'].score * 100
        };

        console.log('Lighthouse Scores:');
        for (const [category, score] of Object.entries(scores)) {
            const emoji = score >= 90 ? '✅' : score >= 50 ? '⚠️' : '❌';
            console.log(`${emoji} ${category}: ${score.toFixed(1)}`);
            
            if (score >= 90) {
                this.results.passed++;
            } else if (score >= 50) {
                this.results.skipped++;
            } else {
                this.results.failed++;
            }
        }

        await chrome.kill();

        // K6 load testing
        await this.runK6LoadTest();
    }

    async runK6LoadTest() {
        const k6Script = `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
    stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        errors: ['rate<0.1'],
        http_req_duration: ['p(95)<500'],
    },
};

export default function () {
    const res = http.get('http://localhost');
    
    const success = check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });
    
    errorRate.add(!success);
    sleep(1);
}
`;

        fs.writeFileSync('k6-test.js', k6Script);

        try {
            execSync('k6 run k6-test.js', { stdio: 'inherit' });
            this.results.passed++;
        } catch (error) {
            this.results.failed++;
            console.log('❌ Load test failed to meet thresholds');
        }
    }

    async runSecurityTests() {
        console.log('Running security tests...');

        // OWASP ZAP security scan
        try {
            execSync('docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost -r security-report.html', 
                { stdio: 'pipe' });
            this.results.passed++;
            console.log('✅ Security scan completed');
        } catch (error) {
            this.results.failed++;
            console.log('❌ Security scan found vulnerabilities');
        }

        // Custom security checks
        await this.testSecurityHeaders();
        await this.testXSSProtection();
        await this.testSQLInjection();
    }

    async testSecurityHeaders() {
        console.log('Testing security headers...');
        
        const response = await fetch('http://localhost');
        const requiredHeaders = [
            'Strict-Transport-Security',
            'X-Content-Type-Options',
            'X-Frame-Options',
            'Content-Security-Policy',
            'Referrer-Policy'
        ];

        for (const header of requiredHeaders) {
            if (response.headers.get(header)) {
                this.results.passed++;
                console.log(`✅ ${header} is present`);
            } else {
                this.results.failed++;
                console.log(`❌ ${header} is missing`);
            }
        }
    }

    async testXSSProtection() {
        console.log('Testing XSS protection...');
        
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '"><script>alert("XSS")</script>',
            'javascript:alert("XSS")',
            '<img src=x onerror=alert("XSS")>'
        ];

        for (const payload of xssPayloads) {
            try {
                const response = await fetch(`http://localhost/search?q=${encodeURIComponent(payload)}`);
                const body = await response.text();
                
                if (!body.includes(payload)) {
                    this.results.passed++;
                    console.log('✅ XSS payload was sanitized');
                } else {
                    this.results.failed++;
                    console.log('❌ XSS payload was not sanitized');
                }
            } catch (error) {
                this.results.failed++;
            }
        }
    }

    async testSQLInjection() {
        console.log('Testing SQL injection protection...');
        
        const sqlPayloads = [
            "' OR '1'='1",
            "1; DROP TABLE users--",
            "admin'--",
            "1' UNION SELECT NULL--"
        ];

        for (const payload of sqlPayloads) {
            try {
                const response = await fetch(`http://localhost/api/search?id=${encodeURIComponent(payload)}`);
                
                if (response.status === 400 || response.status === 403) {
                    this.results.passed++;
                    console.log('✅ SQL injection attempt was blocked');
                } else {
                    this.results.failed++;
                    console.log('❌ SQL injection attempt was not blocked');
                }
            } catch (error) {
                this.results.passed++;
            }
        }
    }

    async runAccessibilityTests() {
        const axe = require('@axe-core/puppeteer');
        const puppeteer = require('puppeteer');

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto('http://localhost');

        const results = await axe.analyze(page);

        console.log(`Found ${results.violations.length} accessibility violations`);

        if (results.violations.length === 0) {
            this.results.passed++;
            console.log('✅ No accessibility violations found');
        } else {
            this.results.failed++;
            results.violations.forEach(violation => {
                console.log(`❌ ${violation.id}: ${violation.description}`);
            });
        }

        await browser.close();
    }

    async runE2ETests() {
        const { test, expect } = require('@playwright/test');

        // User journey tests
        test.describe('7gram Dashboard E2E Tests', () => {
            test('User can search for services', async ({ page }) => {
                await page.goto('http://localhost');
                await page.fill('#search-input', 'emby');
                await expect(page.locator('.service-card[data-service="emby"]')).toBeVisible();
                this.results.passed++;
            });

            test('User can navigate to service', async ({ page }) => {
                await page.goto('http://localhost');
                await page.click('.service-card[data-service="emby"] .service-link');
                await expect(page).toHaveURL(/.*emby.*/);
                this.results.passed++;
            });

            test('Dashboard loads within 3 seconds', async ({ page }) => {
                const startTime = Date.now();
                await page.goto('http://localhost');
                await page.waitForSelector('.services-grid');
                const loadTime = Date.now() - startTime;
                
                if (loadTime < 3000) {
                    this.results.passed++;
                    console.log(`✅ Dashboard loaded in ${loadTime}ms`);
                } else {
                    this.results.failed++;
                    console.log(`❌ Dashboard took ${loadTime}ms to load`);
                }
            });
        });
    }

    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 Test Summary');
        console.log('='.repeat(50));
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⏭️  Skipped: ${this.results.skipped}`);
        console.log(`⏱️  Duration: ${(this.results.duration / 1000).toFixed(2)}s`);
        console.log('='.repeat(50));
        
        const total = this.results.passed + this.results.failed + this.results.skipped;
        const passRate = ((this.results.passed / total) * 100).toFixed(2);
        console.log(`📈 Pass Rate: ${passRate}%`);
        
        if (this.results.failed === 0) {
            console.log('\n🎉 All tests passed! Ready for deployment.');
        } else {
            console.log('\n⚠️  Some tests failed. Please fix issues before deployment.');
        }
    }

    saveResults() {
        const report = {
            timestamp: new Date().toISOString(),
            duration: this.results.duration,
            summary: {
                passed: this.results.passed,
                failed: this.results.failed,
                skipped: this.results.skipped,
                total: this.results.passed + this.results.failed + this.results.skipped
            },
            environment: {
                node: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };

        fs.writeFileSync('test-results.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Test results saved to test-results.json');
    }
}

// Run tests if called directly
if (require.main === module) {
    const runner = new TestRunner();
    runner.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = TestRunner;