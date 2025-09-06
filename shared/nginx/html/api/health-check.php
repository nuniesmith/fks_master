<?php
/**
 * Health Check API for 7Gram Dashboard
 * Provides service health monitoring and status endpoints
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

class HealthChecker {
    private $servicesFile = '..config/services.json';
    private $healthCacheFile = '../cache/health-status.json';
    private $cacheTimeout = 60; // 1 minute
    private $requestTimeout = 10; // 10 seconds
    private $maxRetries = 3;
    
    public function checkAllServices() {
        try {
            $services = $this->loadServices();
            $healthResults = [];
            
            foreach ($services as $service) {
                if (isset($service['healthCheck'])) {
                    $healthResults[] = $this->checkServiceHealth($service);
                } else {
                    $healthResults[] = [
                        'serviceId' => $service['id'],
                        'serviceName' => $service['name'],
                        'status' => 'unknown',
                        'message' => 'No health check configured',
                        'timestamp' => date('c'),
                        'responseTime' => null
                    ];
                }
            }
            
            // Cache the results
            $this->cacheHealthResults($healthResults);
            
            return [
                'success' => true,
                'timestamp' => date('c'),
                'results' => $healthResults,
                'summary' => $this->generateSummary($healthResults)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'timestamp' => date('c')
            ];
        }
    }
    
    public function checkSingleService($serviceId) {
        try {
            $services = $this->loadServices();
            $service = null;
            
            foreach ($services as $s) {
                if ($s['id'] === $serviceId) {
                    $service = $s;
                    break;
                }
            }
            
            if (!$service) {
                throw new Exception("Service not found: $serviceId");
            }
            
            $result = $this->checkServiceHealth($service);
            
            return [
                'success' => true,
                'timestamp' => date('c'),
                'result' => $result
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'timestamp' => date('c')
            ];
        }
    }
    
    public function getCachedHealth() {
        try {
            if (!file_exists($this->healthCacheFile)) {
                return null;
            }
            
            $cacheTime = filemtime($this->healthCacheFile);
            if (time() - $cacheTime > $this->cacheTimeout) {
                return null;
            }
            
            $cached = json_decode(file_get_contents($this->healthCacheFile), true);
            return $cached;
            
        } catch (Exception $e) {
            return null;
        }
    }
    
    private function checkServiceHealth($service) {
        $startTime = microtime(true);
        $healthCheck = $service['healthCheck'];
        
        try {
            if (is_string($healthCheck)) {
                $result = $this->simpleHealthCheck($healthCheck);
            } elseif (is_array($healthCheck)) {
                $result = $this->advancedHealthCheck($healthCheck);
            } else {
                throw new Exception('Invalid health check configuration');
            }
            
            $responseTime = round((microtime(true) - $startTime) * 1000);
            
            return [
                'serviceId' => $service['id'],
                'serviceName' => $service['name'],
                'status' => $result['status'],
                'message' => $result['message'],
                'httpStatus' => $result['httpStatus'] ?? null,
                'responseTime' => $responseTime,
                'timestamp' => date('c'),
                'checks' => $result['checks'] ?? []
            ];
            
        } catch (Exception $e) {
            $responseTime = round((microtime(true) - $startTime) * 1000);
            
            return [
                'serviceId' => $service['id'],
                'serviceName' => $service['name'],
                'status' => 'error',
                'message' => $e->getMessage(),
                'responseTime' => $responseTime,
                'timestamp' => date('c'),
                'error' => true
            ];
        }
    }
    
    private function simpleHealthCheck($url) {
        $context = stream_context_create([
            'http' => [
                'method' => 'HEAD',
                'timeout' => $this->requestTimeout,
                'user_agent' => '7gram-health-checker/1.0',
                'ignore_errors' => true
            ]
        ]);
        
        $response = @file_get_contents($url, false, $context);
        
        if ($response === false) {
            // Try to get more info about the error
            $error = error_get_last();
            throw new Exception($error['message'] ?? 'Connection failed');
        }
        
        // Parse HTTP response code
        $httpCode = 0;
        if (isset($http_response_header[0])) {
            preg_match('/HTTP\/\d\.\d\s+(\d+)/', $http_response_header[0], $matches);
            $httpCode = isset($matches[1]) ? (int)$matches[1] : 0;
        }
        
        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'status' => 'healthy',
                'message' => "Service responding (HTTP $httpCode)",
                'httpStatus' => $httpCode
            ];
        } elseif ($httpCode >= 300 && $httpCode < 400) {
            return [
                'status' => 'warning',
                'message' => "Service redirecting (HTTP $httpCode)",
                'httpStatus' => $httpCode
            ];
        } elseif ($httpCode >= 400) {
            return [
                'status' => 'error',
                'message' => "Service error (HTTP $httpCode)",
                'httpStatus' => $httpCode
            ];
        } else {
            return [
                'status' => 'error',
                'message' => 'Invalid response',
                'httpStatus' => $httpCode
            ];
        }
    }
    
    private function advancedHealthCheck($config) {
        $url = $config['url'];
        $method = $config['method'] ?? 'GET';
        $expectedStatus = $config['expectedStatus'] ?? [200, 201, 202, 204];
        $timeout = $config['timeout'] ?? $this->requestTimeout;
        $headers = $config['headers'] ?? [];
        $body = $config['body'] ?? null;
        
        // Ensure expectedStatus is an array
        if (!is_array($expectedStatus)) {
            $expectedStatus = [$expectedStatus];
        }
        
        $contextOptions = [
            'http' => [
                'method' => strtoupper($method),
                'timeout' => $timeout,
                'user_agent' => '7gram-health-checker/1.0',
                'ignore_errors' => true
            ]
        ];
        
        // Add custom headers
        if (!empty($headers)) {
            $headerStrings = [];
            foreach ($headers as $name => $value) {
                $headerStrings[] = "$name: $value";
            }
            $contextOptions['http']['header'] = implode("\r\n", $headerStrings);
        }
        
        // Add body for POST/PUT requests
        if ($body && in_array(strtoupper($method), ['POST', 'PUT', 'PATCH'])) {
            $contextOptions['http']['content'] = is_array($body) ? json_encode($body) : $body;
            if (!isset($headers['Content-Type'])) {
                $contextOptions['http']['header'] = ($contextOptions['http']['header'] ?? '') . 
                    "\r\nContent-Type: application/json";
            }
        }
        
        $context = stream_context_create($contextOptions);
        $response = @file_get_contents($url, false, $context);
        
        if ($response === false) {
            $error = error_get_last();
            throw new Exception($error['message'] ?? 'Connection failed');
        }
        
        // Parse HTTP response code
        $httpCode = 0;
        if (isset($http_response_header[0])) {
            preg_match('/HTTP\/\d\.\d\s+(\d+)/', $http_response_header[0], $matches);
            $httpCode = isset($matches[1]) ? (int)$matches[1] : 0;
        }
        
        $checks = [
            'url' => $url,
            'method' => $method,
            'expectedStatus' => $expectedStatus,
            'actualStatus' => $httpCode
        ];
        
        if (in_array($httpCode, $expectedStatus)) {
            return [
                'status' => 'healthy',
                'message' => "Service healthy (HTTP $httpCode)",
                'httpStatus' => $httpCode,
                'checks' => $checks
            ];
        } elseif ($httpCode >= 200 && $httpCode < 300) {
            return [
                'status' => 'warning',
                'message' => "Unexpected success status (HTTP $httpCode)",
                'httpStatus' => $httpCode,
                'checks' => $checks
            ];
        } else {
            return [
                'status' => 'error',
                'message' => "Service error (HTTP $httpCode)",
                'httpStatus' => $httpCode,
                'checks' => $checks
            ];
        }
    }
    
    private function loadServices() {
        if (!file_exists($this->servicesFile)) {
            throw new Exception('Services configuration file not found');
        }
        
        $content = file_get_contents($this->servicesFile);
        $config = json_decode($content, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON in services configuration');
        }
        
        return $config['services'] ?? [];
    }
    
    private function cacheHealthResults($results) {
        $cacheDir = dirname($this->healthCacheFile);
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        
        $cacheData = [
            'timestamp' => date('c'),
            'results' => $results,
            'summary' => $this->generateSummary($results)
        ];
        
        file_put_contents($this->healthCacheFile, json_encode($cacheData, JSON_PRETTY_PRINT));
    }
    
    private function generateSummary($results) {
        $summary = [
            'total' => count($results),
            'healthy' => 0,
            'warning' => 0,
            'error' => 0,
            'unknown' => 0
        ];
        
        foreach ($results as $result) {
            $status = $result['status'];
            if (isset($summary[$status])) {
                $summary[$status]++;
            }
        }
        
        $summary['uptime'] = $summary['total'] > 0 ? 
            round(($summary['healthy'] / $summary['total']) * 100, 2) : 0;
        
        return $summary;
    }
    
    public function getSystemHealth() {
        $systemHealth = [
            'timestamp' => date('c'),
            'system' => [
                'phpVersion' => PHP_VERSION,
                'serverTime' => date('c'),
                'timezone' => date_default_timezone_get(),
                'memoryUsage' => $this->formatBytes(memory_get_usage(true)),
                'memoryLimit' => ini_get('memory_limit'),
                'diskSpace' => $this->getDiskSpace()
            ],
            'api' => [
                'status' => 'healthy',
                'version' => '1.0.0',
                'endpoints' => [
                    'health-check' => '/api/health-check.php',
                    'discover-services' => '/api/discover-services.php'
                ]
            ]
        ];
        
        return $systemHealth;
    }
    
    private function formatBytes($size, $precision = 2) {
        $units = ['B', 'KB', 'MB', 'GB'];
        $base = log($size, 1024);
        return round(pow(1024, $base - floor($base)), $precision) . ' ' . $units[floor($base)];
    }
    
    private function getDiskSpace() {
        $bytes = disk_free_space('.');
        $total = disk_total_space('.');
        
        return [
            'free' => $this->formatBytes($bytes),
            'total' => $this->formatBytes($total),
            'used_percentage' => round((($total - $bytes) / $total) * 100, 2)
        ];
    }
}

// Handle the request
$healthChecker = new HealthChecker();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'check-all';
$serviceId = $_GET['service'] ?? null;

try {
    switch ($action) {
        case 'check-all':
            // Check if we should use cached results
            if ($method === 'GET' && !isset($_GET['force'])) {
                $cached = $healthChecker->getCachedHealth();
                if ($cached) {
                    echo json_encode($cached, JSON_PRETTY_PRINT);
                    exit;
                }
            }
            
            $result = $healthChecker->checkAllServices();
            break;
            
        case 'check-service':
            if (!$serviceId) {
                throw new Exception('Service ID required');
            }
            $result = $healthChecker->checkSingleService($serviceId);
            break;
            
        case 'system':
            $result = [
                'success' => true,
                'system' => $healthChecker->getSystemHealth()
            ];
            break;
            
        case 'cached':
            $cached = $healthChecker->getCachedHealth();
            $result = $cached ?: [
                'success' => false,
                'error' => 'No cached health data available'
            ];
            break;
            
        default:
            $result = [
                'success' => false,
                'error' => 'Invalid action',
                'available_actions' => ['check-all', 'check-service', 'system', 'cached']
            ];
    }
    
} catch (Exception $e) {
    $result = [
        'success' => false,
        'error' => $e->getMessage(),
        'timestamp' => date('c')
    ];
}

echo json_encode($result, JSON_PRETTY_PRINT);
?>