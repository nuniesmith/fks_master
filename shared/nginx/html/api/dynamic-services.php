<?php
/**
 * Dynamic Services API for 7Gram Dashboard
 * Handles runtime service registration and management
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

class DynamicServicesManager {
    private $dynamicServicesFile = '../cache/dynamic-services.json';
    private $tempServicesFile = '../cache/temp-services.json';
    private $maxServices = 50;
    private $maxTempServices = 10;
    private $tempServiceTimeout = 3600; // 1 hour
    
    public function __construct() {
        $this->ensureDirectoryExists();
    }
    
    private function ensureDirectoryExists() {
        $cacheDir = dirname($this->dynamicServicesFile);
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
    }
    
    public function getDynamicServices() {
        try {
            $services = [];
            
            // Load persistent dynamic services
            if (file_exists($this->dynamicServicesFile)) {
                $dynamicServices = json_decode(file_get_contents($this->dynamicServicesFile), true);
                if ($dynamicServices && isset($dynamicServices['services'])) {
                    $services = array_merge($services, $dynamicServices['services']);
                }
            }
            
            // Load temporary services (and clean expired ones)
            $tempServices = $this->loadTempServices();
            if (!empty($tempServices)) {
                $services = array_merge($services, $tempServices);
            }
            
            return [
                'success' => true,
                'services' => $services,
                'count' => count($services),
                'timestamp' => date('c')
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'services' => []
            ];
        }
    }
    
    public function addService($serviceData, $temporary = false) {
        try {
            // Validate service data
            $validatedService = $this->validateServiceData($serviceData);
            
            if ($temporary) {
                return $this->addTempService($validatedService);
            } else {
                return $this->addPersistentService($validatedService);
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    public function updateService($serviceId, $serviceData) {
        try {
            $validatedService = $this->validateServiceData($serviceData);
            $validatedService['id'] = $serviceId;
            
            // Try to update in persistent services first
            $updated = $this->updatePersistentService($serviceId, $validatedService);
            
            if (!$updated) {
                // Try to update in temporary services
                $updated = $this->updateTempService($serviceId, $validatedService);
            }
            
            if ($updated) {
                return [
                    'success' => true,
                    'message' => 'Service updated successfully',
                    'service' => $validatedService
                ];
            } else {
                return [
                    'success' => false,
                    'error' => 'Service not found'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    public function removeService($serviceId) {
        try {
            $removed = false;
            
            // Try to remove from persistent services
            $removed = $this->removePersistentService($serviceId);
            
            // Also try to remove from temporary services
            if ($this->removeTempService($serviceId)) {
                $removed = true;
            }
            
            if ($removed) {
                return [
                    'success' => true,
                    'message' => 'Service removed successfully'
                ];
            } else {
                return [
                    'success' => false,
                    'error' => 'Service not found'
                ];
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    private function addPersistentService($service) {
        $services = $this->loadPersistentServices();
        
        // Check if service already exists
        foreach ($services as $existingService) {
            if ($existingService['id'] === $service['id']) {
                throw new Exception('Service with this ID already exists');
            }
        }
        
        // Check service limit
        if (count($services) >= $this->maxServices) {
            throw new Exception('Maximum number of services reached');
        }
        
        $services[] = $service;
        $this->savePersistentServices($services);
        
        return [
            'success' => true,
            'message' => 'Service added successfully',
            'service' => $service,
            'persistent' => true
        ];
    }
    
    private function addTempService($service) {
        $services = $this->loadTempServices(false); // Don't clean expired ones yet
        
        // Check if service already exists
        foreach ($services as $existingService) {
            if ($existingService['id'] === $service['id']) {
                throw new Exception('Temporary service with this ID already exists');
            }
        }
        
        // Check temp service limit
        if (count($services) >= $this->maxTempServices) {
            // Remove oldest temp service
            array_shift($services);
        }
        
        // Add expiration timestamp
        $service['tempService'] = true;
        $service['expiresAt'] = time() + $this->tempServiceTimeout;
        $service['addedAt'] = time();
        
        $services[] = $service;
        $this->saveTempServices($services);
        
        return [
            'success' => true,
            'message' => 'Temporary service added successfully',
            'service' => $service,
            'persistent' => false,
            'expiresIn' => $this->tempServiceTimeout
        ];
    }
    
    private function loadPersistentServices() {
        if (!file_exists($this->dynamicServicesFile)) {
            return [];
        }
        
        $data = json_decode(file_get_contents($this->dynamicServicesFile), true);
        return $data['services'] ?? [];
    }
    
    private function savePersistentServices($services) {
        $data = [
            'services' => $services,
            'lastUpdated' => date('c'),
            'count' => count($services)
        ];
        
        file_put_contents($this->dynamicServicesFile, json_encode($data, JSON_PRETTY_PRINT));
    }
    
    private function loadTempServices($cleanExpired = true) {
        if (!file_exists($this->tempServicesFile)) {
            return [];
        }
        
        $data = json_decode(file_get_contents($this->tempServicesFile), true);
        $services = $data['services'] ?? [];
        
        if ($cleanExpired) {
            $currentTime = time();
            $services = array_filter($services, function($service) use ($currentTime) {
                return isset($service['expiresAt']) && $service['expiresAt'] > $currentTime;
            });
            
            // Re-index array
            $services = array_values($services);
            
            // Save cleaned services back
            $this->saveTempServices($services);
        }
        
        return $services;
    }
    
    private function saveTempServices($services) {
        $data = [
            'services' => $services,
            'lastUpdated' => date('c'),
            'count' => count($services)
        ];
        
        file_put_contents($this->tempServicesFile, json_encode($data, JSON_PRETTY_PRINT));
    }
    
    private function updatePersistentService($serviceId, $serviceData) {
        $services = $this->loadPersistentServices();
        $updated = false;
        
        for ($i = 0; $i < count($services); $i++) {
            if ($services[$i]['id'] === $serviceId) {
                $services[$i] = array_merge($services[$i], $serviceData);
                $services[$i]['lastUpdated'] = date('c');
                $updated = true;
                break;
            }
        }
        
        if ($updated) {
            $this->savePersistentServices($services);
        }
        
        return $updated;
    }
    
    private function updateTempService($serviceId, $serviceData) {
        $services = $this->loadTempServices(false);
        $updated = false;
        
        for ($i = 0; $i < count($services); $i++) {
            if ($services[$i]['id'] === $serviceId) {
                $services[$i] = array_merge($services[$i], $serviceData);
                $services[$i]['lastUpdated'] = date('c');
                $updated = true;
                break;
            }
        }
        
        if ($updated) {
            $this->saveTempServices($services);
        }
        
        return $updated;
    }
    
    private function removePersistentService($serviceId) {
        $services = $this->loadPersistentServices();
        $originalCount = count($services);
        
        $services = array_filter($services, function($service) use ($serviceId) {
            return $service['id'] !== $serviceId;
        });
        
        $services = array_values($services); // Re-index
        
        if (count($services) < $originalCount) {
            $this->savePersistentServices($services);
            return true;
        }
        
        return false;
    }
    
    private function removeTempService($serviceId) {
        $services = $this->loadTempServices(false);
        $originalCount = count($services);
        
        $services = array_filter($services, function($service) use ($serviceId) {
            return $service['id'] !== $serviceId;
        });
        
        $services = array_values($services); // Re-index
        
        if (count($services) < $originalCount) {
            $this->saveTempServices($services);
            return true;
        }
        
        return false;
    }
    
    private function validateServiceData($data) {
        $required = ['name', 'url'];
        $optional = [
            'id', 'description', 'category', 'icon', 'type', 'version',
            'buttonText', 'priority', 'tags', 'healthCheck', 'features'
        ];
        
        // Check required fields
        foreach ($required as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                throw new Exception("Required field '$field' is missing or empty");
            }
        }
        
        // Validate URL
        if (!filter_var($data['url'], FILTER_VALIDATE_URL)) {
            throw new Exception('Invalid URL format');
        }
        
        // Generate ID if not provided
        if (!isset($data['id']) || empty($data['id'])) {
            $data['id'] = $this->generateServiceId($data['name']);
        }
        
        // Set defaults
        $validated = [
            'id' => $data['id'],
            'name' => $data['name'],
            'description' => $data['description'] ?? 'Dynamically added service',
            'url' => $data['url'],
            'category' => $data['category'] ?? 'Dynamic Services',
            'categoryIcon' => $data['categoryIcon'] ?? '⚡',
            'categoryColor' => $data['categoryColor'] ?? 'system',
            'icon' => $data['icon'] ?? '🔗',
            'type' => $data['type'] ?? 'Service',
            'version' => $data['version'] ?? null,
            'buttonText' => $data['buttonText'] ?? 'Open ' . $data['name'],
            'priority' => intval($data['priority'] ?? 0),
            'tags' => $data['tags'] ?? ['dynamic'],
            'healthCheck' => $data['healthCheck'] ?? null,
            'features' => $data['features'] ?? [],
            'addedAt' => date('c'),
            'dynamic' => true
        ];
        
        // Validate tags
        if (is_string($validated['tags'])) {
            $validated['tags'] = explode(',', $validated['tags']);
        }
        
        return $validated;
    }
    
    private function generateServiceId($name) {
        $id = strtolower(preg_replace('/[^a-zA-Z0-9]/', '-', $name));
        $id = preg_replace('/-+/', '-', $id);
        $id = trim($id, '-');
        
        // Ensure uniqueness
        $existingServices = array_merge(
            $this->loadPersistentServices(),
            $this->loadTempServices(false)
        );
        
        $baseId = $id;
        $counter = 1;
        
        while ($this->serviceIdExists($id, $existingServices)) {
            $id = $baseId . '-' . $counter;
            $counter++;
        }
        
        return $id;
    }
    
    private function serviceIdExists($id, $services) {
        foreach ($services as $service) {
            if ($service['id'] === $id) {
                return true;
            }
        }
        return false;
    }
    
    public function getServiceStats() {
        $persistentServices = $this->loadPersistentServices();
        $tempServices = $this->loadTempServices();
        
        return [
            'success' => true,
            'stats' => [
                'persistent' => count($persistentServices),
                'temporary' => count($tempServices),
                'total' => count($persistentServices) + count($tempServices),
                'maxPersistent' => $this->maxServices,
                'maxTemporary' => $this->maxTempServices,
                'tempTimeout' => $this->tempServiceTimeout
            ],
            'timestamp' => date('c')
        ];
    }
    
    public function cleanupExpiredServices() {
        $tempServices = $this->loadTempServices(true); // This will clean expired ones
        
        return [
            'success' => true,
            'message' => 'Expired services cleaned up',
            'remainingTempServices' => count($tempServices)
        ];
    }
}

// Handle the request
try {
    $manager = new DynamicServicesManager();
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? 'list';
    $serviceId = $_GET['id'] ?? null;
    
    switch ($method) {
        case 'GET':
            switch ($action) {
                case 'list':
                    $result = $manager->getDynamicServices();
                    break;
                    
                case 'stats':
                    $result = $manager->getServiceStats();
                    break;
                    
                case 'cleanup':
                    $result = $manager->cleanupExpiredServices();
                    break;
                    
                default:
                    $result = [
                        'success' => false,
                        'error' => 'Invalid action',
                        'available_actions' => ['list', 'stats', 'cleanup']
                    ];
            }
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input) {
                throw new Exception('Invalid JSON input');
            }
            
            $temporary = isset($_GET['temp']) && $_GET['temp'] === 'true';
            $result = $manager->addService($input, $temporary);
            break;
            
        case 'PUT':
            if (!$serviceId) {
                throw new Exception('Service ID required for updates');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            if (!$input) {
                throw new Exception('Invalid JSON input');
            }
            
            $result = $manager->updateService($serviceId, $input);
            break;
            
        case 'DELETE':
            if (!$serviceId) {
                throw new Exception('Service ID required for deletion');
            }
            
            $result = $manager->removeService($serviceId);
            break;
            
        default:
            $result = [
                'success' => false,
                'error' => 'Method not allowed',
                'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE']
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