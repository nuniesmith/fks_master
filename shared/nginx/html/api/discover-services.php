<?php
/**
 * Service Discovery API for 7Gram Dashboard
 * Automatically discovers services from directory structure
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

class ServiceDiscovery {
    private $servicesDir = '../services/';
    private $cacheFile = '../cache/discovered-services.json';
    private $cacheTimeout = 300; // 5 minutes
    
    public function discoverServices() {
        // Check cache first
        $cachedServices = $this->getCachedServices();
        if ($cachedServices !== null) {
            return $cachedServices;
        }
        
        $discoveredServices = [];
        
        try {
            $categories = $this->scanServiceDirectories();
            
            foreach ($categories as $categoryDir => $categoryPath) {
                $categoryServices = $this->loadCategoryServices($categoryPath, $categoryDir);
                $discoveredServices = array_merge($discoveredServices, $categoryServices);
            }
            
            // Validate and clean services
            $validServices = $this->validateServices($discoveredServices);
            
            // Cache the results
            $this->cacheServices($validServices);
            
            return [
                'success' => true,
                'services' => $validServices,
                'discovered_at' => date('c'),
                'total_count' => count($validServices),
                'categories' => array_keys($categories)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'services' => []
            ];
        }
    }
    
    private function scanServiceDirectories() {
        $categories = [];
        
        if (!is_dir($this->servicesDir)) {
            throw new Exception("Services directory not found: " . $this->servicesDir);
        }
        
        $directories = scandir($this->servicesDir);
        
        foreach ($directories as $dir) {
            if ($dir === '.' || $dir === '..') continue;
            
            $fullPath = $this->servicesDir . $dir;
            if (is_dir($fullPath)) {
                $categories[$dir] = $fullPath;
            }
        }
        
        return $categories;
    }
    
    private function loadCategoryServices($categoryPath, $categoryName) {
        $services = [];
        
        // Load category index.json if it exists
        $indexFile = $categoryPath . '/index.json';
        $categoryConfig = [];
        
        if (file_exists($indexFile)) {
            $categoryConfig = json_decode(file_get_contents($indexFile), true);
            if (isset($categoryConfig['services'])) {
                foreach ($categoryConfig['services'] as $service) {
                    $service['category'] = $categoryConfig['category'] ?? ucfirst($categoryName);
                    $service['categoryIcon'] = $categoryConfig['icon'] ?? '📦';
                    $service['categoryColor'] = $categoryConfig['color'] ?? 'system';
                    $service['discovered'] = true;
                    $service['discoveredFrom'] = $categoryPath;
                    $services[] = $service;
                }
            }
        }
        
        // Also scan for individual service JSON files
        $files = scandir($categoryPath);
        foreach ($files as $file) {
            if (pathinfo($file, PATHINFO_EXTENSION) === 'json' && $file !== 'index.json') {
                $serviceFile = $categoryPath . '/' . $file;
                $serviceData = json_decode(file_get_contents($serviceFile), true);
                
                if ($serviceData && isset($serviceData['name'])) {
                    $serviceData['category'] = $categoryConfig['category'] ?? ucfirst($categoryName);
                    $serviceData['categoryIcon'] = $categoryConfig['icon'] ?? '📦';
                    $serviceData['categoryColor'] = $categoryConfig['color'] ?? 'system';
                    $serviceData['discovered'] = true;
                    $serviceData['discoveredFrom'] = $serviceFile;
                    $services[] = $serviceData;
                }
            }
        }
        
        return $services;
    }
    
    private function validateServices($services) {
        $validServices = [];
        
        foreach ($services as $service) {
            // Required fields
            if (empty($service['name']) || empty($service['url'])) {
                continue;
            }
            
            // Generate ID if missing
            if (empty($service['id'])) {
                $service['id'] = $this->generateServiceId($service['name']);
            }
            
            // Set defaults
            $service['description'] = $service['description'] ?? 'No description available';
            $service['icon'] = $service['icon'] ?? '🔗';
            $service['category'] = $service['category'] ?? 'Other';
            $service['priority'] = intval($service['priority'] ?? 0);
            $service['tags'] = $service['tags'] ?? [];
            $service['buttonText'] = $service['buttonText'] ?? 'Open ' . $service['name'];
            $service['lastUpdated'] = date('c');
            
            // Validate URL
            if (!filter_var($service['url'], FILTER_VALIDATE_URL)) {
                continue;
            }
            
            $validServices[] = $service;
        }
        
        // Sort by priority (higher first)
        usort($validServices, function($a, $b) {
            return $b['priority'] - $a['priority'];
        });
        
        return $validServices;
    }
    
    private function generateServiceId($name) {
        return strtolower(preg_replace('/[^a-zA-Z0-9]/', '-', $name));
    }
    
    private function getCachedServices() {
        if (!file_exists($this->cacheFile)) {
            return null;
        }
        
        $cacheTime = filemtime($this->cacheFile);
        if (time() - $cacheTime > $this->cacheTimeout) {
            return null;
        }
        
        $cached = json_decode(file_get_contents($this->cacheFile), true);
        return $cached;
    }
    
    private function cacheServices($services) {
        $cacheDir = dirname($this->cacheFile);
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        
        $cacheData = [
            'success' => true,
            'services' => $services,
            'cached_at' => date('c'),
            'total_count' => count($services)
        ];
        
        file_put_contents($this->cacheFile, json_encode($cacheData, JSON_PRETTY_PRINT));
    }
    
    public function clearCache() {
        if (file_exists($this->cacheFile)) {
            unlink($this->cacheFile);
        }
        return ['success' => true, 'message' => 'Cache cleared'];
    }
}

// Handle the request
$discovery = new ServiceDiscovery();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'discover';

switch ($action) {
    case 'discover':
        $result = $discovery->discoverServices();
        break;
        
    case 'clear-cache':
        $result = $discovery->clearCache();
        break;
        
    default:
        $result = [
            'success' => false,
            'error' => 'Invalid action',
            'available_actions' => ['discover', 'clear-cache']
        ];
}

echo json_encode($result, JSON_PRETTY_PRINT);
?>