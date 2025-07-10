/**
 * JWT Authentication middleware for Nexus Console
 * Compatible with Happy Observatory authentication
 */

import crypto from 'crypto';

import type { Request, Response, NextFunction } from 'express';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';

// Extended Request type with auth
export interface AuthRequest extends Request {
  auth?: {
    userId: string;
    permissions: string[];
    projectIds: string[];
    jti: string;
  };
}

// JWT configuration
export interface JWTConfig {
  secret: string;
  issuer: string;
  audience: string;
  expiresIn: string;
}

// Token payload
export interface TokenPayload extends JWTPayload {
  userId: string;
  permissions: string[];
  projectIds: string[];
  jti: string;
}

// In-memory revoked token store
class RevokedTokenStore {
  private store: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    // Clean up expired tokens every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }
  
  revoke(jti: string, expiresAt: number) {
    this.store.set(jti, expiresAt);
  }
  
  isRevoked(jti: string): boolean {
    const expiresAt = this.store.get(jti);
    if (!expiresAt) return false;
    
    // Check if token has expired
    if (Date.now() > expiresAt) {
      this.store.delete(jti);
      return false;
    }
    
    return true;
  }
  
  revokeAllForUser(userId: string, tokens: Array<{ jti: string; exp: number }>) {
    tokens.forEach(token => {
      this.revoke(token.jti, token.exp * 1000);
    });
  }
  
  private cleanup() {
    const now = Date.now();
    for (const [jti, expiresAt] of this.store.entries()) {
      if (now > expiresAt) {
        this.store.delete(jti);
      }
    }
  }
  
  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global revoked token store
const revokedTokens = new RevokedTokenStore();

// Generate JWT
export async function generateToken(
  payload: Omit<TokenPayload, 'jti' | 'iat' | 'exp' | 'iss' | 'aud'>,
  config: JWTConfig
): Promise<string> {
  const jti = crypto.randomBytes(16).toString('hex');
  const secret = new TextEncoder().encode(config.secret);
  
  const jwt = await new SignJWT({
    ...payload,
    jti
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime(config.expiresIn)
    .sign(secret);
  
  return jwt;
}

// Verify JWT
export async function verifyToken(
  token: string,
  config: JWTConfig
): Promise<TokenPayload> {
  const secret = new TextEncoder().encode(config.secret);
  
  const { payload } = await jwtVerify(token, secret, {
    issuer: config.issuer,
    audience: config.audience
  });
  
  // Check if token is revoked
  if (payload.jti && revokedTokens.isRevoked(payload.jti)) {
    throw new Error('Token has been revoked');
  }
  
  return payload as TokenPayload;
}

// Authentication middleware
export function authenticate(config: JWTConfig) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Get token from Authorization header or cookie
      let token: string | undefined;
      
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (req.cookies && req.cookies['auth-token']) {
        token = req.cookies['auth-token'];
      }
      
      if (!token) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'No authentication token provided'
        });
      }
      
      // Verify token
      const payload = await verifyToken(token, config);
      
      // Attach auth info to request
      req.auth = {
        userId: payload.userId,
        permissions: payload.permissions || [],
        projectIds: payload.projectIds || [],
        jti: payload.jti
      };
      
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
  };
}

// Permission checking middleware
export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    if (!req.auth.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permission '${permission}' required`
      });
    }
    
    next();
  };
}

// Project access checking middleware
export function requireProjectAccess(getProjectId: (req: Request) => string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const projectId = getProjectId(req);
    
    if (!req.auth.projectIds.includes(projectId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access to this project is denied'
      });
    }
    
    next();
  };
}

// Revoke token
export function revokeToken(jti: string, expiresAt: number) {
  revokedTokens.revoke(jti, expiresAt);
}

// Revoke all tokens for user
export function revokeAllTokensForUser(
  userId: string,
  tokens: Array<{ jti: string; exp: number }>
) {
  revokedTokens.revokeAllForUser(userId, tokens);
}

// Check if user has permission
export function hasPermission(auth: AuthRequest['auth'], permission: string): boolean {
  return auth?.permissions.includes(permission) || false;
}

// Check if user has project access
export function hasProjectAccess(auth: AuthRequest['auth'], projectId: string): boolean {
  return auth?.projectIds.includes(projectId) || false;
}

// Cleanup function for graceful shutdown
export function cleanupAuth() {
  revokedTokens.destroy();
}