/**
 * Security middleware for Nexus Console server
 * Implements security features compatible with Happy Observatory
 */

import crypto from 'crypto';

import type { Request, Response, NextFunction } from 'express';

// Types
export interface SecurityConfig {
  enableCSP: boolean;
  enableRateLimit: boolean;
  trustProxyHeaders: boolean;
  jwtSecret?: string;
  sessionSecret?: string;
  allowedOrigins: string[];
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

// Generate nonce for CSP
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

// Content Security Policy middleware
export function contentSecurityPolicy() {
  return (req: Request, res: Response, next: NextFunction) => {
    const nonce = generateNonce();
    
    // Store nonce on request for use in templates
    (req as any).nonce = nonce;
    
    // Set CSP header
    const cspDirectives = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'unsafe-inline'`, // Allow inline styles for terminal
      `img-src 'self' data: blob:`,
      `font-src 'self'`,
      `connect-src 'self' ws: wss:`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`
    ].join('; ');
    
    res.setHeader('Content-Security-Policy', cspDirectives);
    next();
  };
}

// Security headers middleware
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Enable XSS protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // HSTS for HTTPS
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }
    
    next();
  };
}

// CORS configuration
export function corsMiddleware(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      res.setHeader(
        'Access-Control-Expose-Headers',
        'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After'
      );
    }
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
    } else {
      next();
    }
  };
}

// Rate limiting store (in-memory)
class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly maxEntries = 10000;
  
  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const resetTime = now + windowMs;
    
    const existing = this.store.get(key);
    
    if (existing && existing.resetTime > now) {
      existing.count++;
      return existing;
    }
    
    // Clean up old entries if we're at capacity
    if (this.store.size >= this.maxEntries) {
      this.cleanup();
    }
    
    const entry = { count: 1, resetTime };
    this.store.set(key, entry);
    return entry;
  }
  
  private cleanup() {
    const now = Date.now();
    const entries = Array.from(this.store.entries());
    
    // Remove expired entries
    entries.forEach(([key, value]) => {
      if (value.resetTime <= now) {
        this.store.delete(key);
      }
    });
    
    // If still over capacity, remove oldest entries
    if (this.store.size >= this.maxEntries) {
      const sorted = entries.sort((a, b) => a[1].resetTime - b[1].resetTime);
      const toRemove = sorted.slice(0, this.store.size - this.maxEntries + 1000);
      toRemove.forEach(([key]) => this.store.delete(key));
    }
  }
}

// Rate limiting middleware
export function rateLimit(config: RateLimitConfig) {
  const store = new RateLimitStore();
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Get client IP
    const ip = getClientIp(req);
    const key = `rate-limit:${ip}`;
    
    const { count, resetTime } = store.increment(key, config.windowMs);
    const remaining = Math.max(0, config.max - count);
    const resetDate = new Date(resetTime);
    
    // Set rate limit headers
    if (config.standardHeaders) {
      res.setHeader('X-RateLimit-Limit', config.max.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetDate.toISOString());
    }
    
    if (config.legacyHeaders) {
      res.setHeader('X-RateLimit-Limit', config.max.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());
    }
    
    // Check if limit exceeded
    if (count > config.max) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: config.message,
        retryAfter
      });
    }
    
    next();
  };
}

// Get client IP with proxy support
export function getClientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY_HEADERS === 'true';
  
  if (trustProxy) {
    // Check various proxy headers
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = (forwardedFor as string).split(',').map(ip => ip.trim());
      return ips[0];
    }
    
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp as string;
    }
    
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    if (cfConnectingIp) {
      return cfConnectingIp as string;
    }
  }
  
  // Fall back to socket address
  return req.socket.remoteAddress || 'unknown';
}

// Combined security middleware
export function createSecurityMiddleware(config: SecurityConfig) {
  const middlewares: any[] = [];
  
  // Always add security headers
  middlewares.push(securityHeaders());
  
  // Add CSP if enabled
  if (config.enableCSP) {
    middlewares.push(contentSecurityPolicy());
  }
  
  // Add CORS
  middlewares.push(corsMiddleware(config.allowedOrigins));
  
  // Add rate limiting if enabled
  if (config.enableRateLimit) {
    // Global rate limit
    middlewares.push(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false
    }));
  }
  
  return middlewares;
}