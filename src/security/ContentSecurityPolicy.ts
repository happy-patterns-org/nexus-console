/**
 * Content Security Policy implementation for Nexus Console
 * Provides security headers and CSP directives for web interface
 */

import type { IncomingHttpHeaders, ServerResponse } from 'http';

export interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'connect-src'?: string[];
  'font-src'?: string[];
  'object-src'?: string[];
  'media-src'?: string[];
  'frame-src'?: string[];
  'child-src'?: string[];
  'worker-src'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'base-uri'?: string[];
  'manifest-src'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

export interface SecurityHeadersConfig {
  csp?: CSPDirectives;
  strictTransportSecurity?: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  xContentTypeOptions?: 'nosniff';
  xFrameOptions?: 'DENY' | 'SAMEORIGIN';
  xXssProtection?: '0' | '1' | '1; mode=block';
  referrerPolicy?: 
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';
  permissionsPolicy?: Record<string, string[]>;
}

export class ContentSecurityPolicy {
  private readonly defaultCSP: CSPDirectives = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"], // Required for terminal styling
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", 'ws:', 'wss:'],
    'font-src': ["'self'"],
    'object-src': ["'none'"],
    'media-src': ["'none'"],
    'frame-src': ["'none'"],
    'child-src': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'upgrade-insecure-requests': true
  };

  private readonly defaultHeaders: SecurityHeadersConfig = {
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true
    },
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'DENY',
    xXssProtection: '1; mode=block',
    referrerPolicy: 'strict-origin-when-cross-origin'
  };

  constructor(private config?: SecurityHeadersConfig) {}

  /**
   * Generate nonce for inline scripts
   */
  generateNonce(): string {
    const array = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for Node.js
      // @ts-expect-error Dynamic require for Node.js environment
      const nodeCrypto = require('crypto');
      nodeCrypto.randomFillSync(array);
    }
    return Buffer.from(array).toString('base64');
  }

  /**
   * Build CSP header string
   */
  buildCSPHeader(directives?: CSPDirectives, nonce?: string): string {
    const csp = { ...this.defaultCSP, ...directives };
    const parts: string[] = [];

    // Add nonce to script-src if provided
    if (nonce && csp['script-src']) {
      csp['script-src'] = [...csp['script-src'], `'nonce-${nonce}'`];
    }

    for (const [directive, value] of Object.entries(csp)) {
      if (directive === 'upgrade-insecure-requests' || 
          directive === 'block-all-mixed-content') {
        if (value === true) {
          parts.push(directive);
        }
      } else if (Array.isArray(value) && value.length > 0) {
        parts.push(`${directive} ${value.join(' ')}`);
      }
    }

    return parts.join('; ');
  }

  /**
   * Apply security headers to response
   */
  applyHeaders(res: ServerResponse, options?: { nonce?: string }): void {
    const config = { ...this.defaultHeaders, ...this.config };
    const nonce = options?.nonce;

    // Content Security Policy
    const cspHeader = this.buildCSPHeader(config.csp, nonce);
    res.setHeader('Content-Security-Policy', cspHeader);

    // Strict Transport Security
    if (config.strictTransportSecurity) {
      const { maxAge, includeSubDomains, preload } = config.strictTransportSecurity;
      let stsValue = `max-age=${maxAge}`;
      if (includeSubDomains) stsValue += '; includeSubDomains';
      if (preload) stsValue += '; preload';
      res.setHeader('Strict-Transport-Security', stsValue);
    }

    // X-Content-Type-Options
    if (config.xContentTypeOptions) {
      res.setHeader('X-Content-Type-Options', config.xContentTypeOptions);
    }

    // X-Frame-Options
    if (config.xFrameOptions) {
      res.setHeader('X-Frame-Options', config.xFrameOptions);
    }

    // X-XSS-Protection
    if (config.xXssProtection) {
      res.setHeader('X-XSS-Protection', config.xXssProtection);
    }

    // Referrer-Policy
    if (config.referrerPolicy) {
      res.setHeader('Referrer-Policy', config.referrerPolicy);
    }

    // Permissions-Policy
    if (config.permissionsPolicy) {
      const permissions = Object.entries(config.permissionsPolicy)
        .map(([feature, allowList]) => `${feature}=(${allowList.join(' ')})`)
        .join(', ');
      res.setHeader('Permissions-Policy', permissions);
    }
  }

  /**
   * Middleware for Express/Connect
   */
  middleware() {
    return (req: any, res: ServerResponse, next: () => void): void => {
      // Generate nonce for this request
      const nonce = this.generateNonce();
      
      // Store nonce on response for use in templates
      (res as any).locals = (res as any).locals || {};
      (res as any).locals.nonce = nonce;

      // Apply security headers
      this.applyHeaders(res, { nonce });

      next();
    };
  }

  /**
   * Get meta tags for HTML
   */
  getMetaTags(nonce?: string): string {
    const config = { ...this.defaultHeaders, ...this.config };
    const tags: string[] = [];

    // CSP
    const cspHeader = this.buildCSPHeader(config.csp, nonce);
    tags.push(`<meta http-equiv="Content-Security-Policy" content="${cspHeader}">`);

    // X-Content-Type-Options
    if (config.xContentTypeOptions) {
      tags.push(
        `<meta http-equiv="X-Content-Type-Options" content="${config.xContentTypeOptions}">`
      );
    }

    // X-Frame-Options
    if (config.xFrameOptions) {
      tags.push(
        `<meta http-equiv="X-Frame-Options" content="${config.xFrameOptions}">`
      );
    }

    // X-XSS-Protection
    if (config.xXssProtection) {
      tags.push(
        `<meta http-equiv="X-XSS-Protection" content="${config.xXssProtection}">`
      );
    }

    return tags.join('\n');
  }
}

// Default instance for convenience
export const defaultCSP = new ContentSecurityPolicy();

// Helper function for WebSocket-specific CSP
export function getWebSocketCSP(wsUrl: string): CSPDirectives {
  const url = new URL(wsUrl);
  const origin = `${url.protocol}//${url.host}`;
  
  return {
    'connect-src': ["'self'", origin, 'ws:', 'wss:']
  };
}

// Helper function for development mode CSP
export function getDevelopmentCSP(): CSPDirectives {
  return {
    'script-src': ["'self'", "'unsafe-eval'"], // Allow eval for HMR
    'connect-src': ["'self'", 'ws:', 'wss:', 'http:', 'https:'] // Allow all for dev
  };
}
