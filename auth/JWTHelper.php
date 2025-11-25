<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


require_once __DIR__ . '/../../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class JWTHelper {
    // Secret key for JWT - CHANGE THIS IN PRODUCTION!
    private static $secret_key = 'selab_nadiry_jwt_secret_key_2024_change_in_production';
    private static $algorithm = 'HS256';
    private static $issuer = 'selab-nadiry-api';
    
    /**
     * Generate a JWT token for a user
     * @param array $userData User data to encode in token
     * @param int $expiryHours Token expiry in hours (default 24)
     * @return string JWT token
     */
    public static function generateToken($userData, $expiryHours = 24) {
        $issuedAt = time();
        $expire = $issuedAt + ($expiryHours * 3600);
        
        $payload = [
            'iss' => self::$issuer,
            'iat' => $issuedAt,
            'exp' => $expire,
            'data' => $userData
        ];
        
        return JWT::encode($payload, self::$secret_key, self::$algorithm);
    }
    
    /**
     * Validate and decode a JWT token
     * @param string $token JWT token to validate
     * @return object|false Decoded token data or false if invalid
     */
    public static function validateToken($token) {
        try {
            $decoded = JWT::decode($token, new Key(self::$secret_key, self::$algorithm));
            return $decoded;
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Get token from Authorization header
     * @return string|null Token or null if not found
     */
    public static function getBearerToken() {
        $headers = null;
        
        if (isset($_SERVER['Authorization'])) {
            $headers = trim($_SERVER["Authorization"]);
        } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
        } else if (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            if (isset($requestHeaders['Authorization'])) {
                $headers = trim($requestHeaders['Authorization']);
            }
        }
        
        if (!empty($headers)) {
            if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
                return $matches[1];
            }
        }
        
        return null;
    }
    
    /**
     * Verify token and return user data
     * @return array|false User data or false if invalid
     */
    public static function verifyRequest() {
        $token = self::getBearerToken();
        
        if (!$token) {
            return false;
        }
        
        $decoded = self::validateToken($token);
        
        if (!$decoded) {
            return false;
        }
        
        return (array) $decoded->data;
    }
    
    /**
     * Send JSON response
     * Supports two formats:
     * 1. sendResponse(['success' => true, 'message' => '...'])
     * 2. sendResponse(200, true, 'Success', $data)
     */
    public static function sendResponse($statusCodeOrArray, $success = null, $message = null, $data = null) {
        // Handle old format (array)
        if (is_array($statusCodeOrArray)) {
            $response = $statusCodeOrArray;
            $statusCode = isset($response['success']) && $response['success'] ? 200 : 400;
        } 
        // Handle new format (statusCode, success, message, data)
        else {
            $statusCode = $statusCodeOrArray;
            $response = [
                'success' => $success,
                'message' => $message
            ];
            
            if ($data !== null) {
                if (is_array($data)) {
                    $response = array_merge($response, $data);
                } else {
                    $response['data'] = $data;
                }
            }
        }
        
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($response);
        exit;
    }
}

