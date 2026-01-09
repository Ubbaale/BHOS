import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Content Security Policy - production-hardened with minimal unsafe directives
  // Note: 'unsafe-inline' is required for React/Vite development HMR
  const isProduction = process.env.NODE_ENV === "production";
  const cspDirectives = [
    "default-src 'self'",
    // In production, remove unsafe-eval; in development, allow for HMR
    isProduction 
      ? "script-src 'self' https://js.stripe.com https://maps.googleapis.com https://unpkg.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com https://*.googleapis.com",
    "connect-src 'self' https://api.stripe.com https://maps.googleapis.com wss://*.replit.dev wss://*.replit.app wss://carehubapp.com wss://www.carehubapp.com wss://carehubapp.replit.app ws://localhost:* wss://localhost:*",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  
  res.setHeader("Content-Security-Policy", cspDirectives);
  
  // HSTS - only in production with HTTPS
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  
  // Permissions Policy
  res.setHeader("Permissions-Policy", "geolocation=(self), microphone=(), camera=()");
  
  next();
}

// CSRF token generation and validation
const csrfTokens: Map<string, { token: string; createdAt: number }> = new Map();
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

export function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokens.set(sessionId, { token, createdAt: Date.now() });
  return token;
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
  const stored = csrfTokens.get(sessionId);
  if (!stored) return false;
  
  // Check expiry
  if (Date.now() - stored.createdAt > CSRF_TOKEN_EXPIRY) {
    csrfTokens.delete(sessionId);
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(stored.token),
      Buffer.from(token)
    );
  } catch {
    return false;
  }
}

// Clean up expired CSRF tokens periodically
setInterval(() => {
  const now = Date.now();
  csrfTokens.forEach((data, sessionId) => {
    if (now - data.createdAt > CSRF_TOKEN_EXPIRY) {
      csrfTokens.delete(sessionId);
    }
  });
}, 15 * 60 * 1000); // Every 15 minutes

// Global rate limiting (requests per minute per IP)
const requestCounts: Map<string, { count: number; resetAt: number }> = new Map();
const GLOBAL_RATE_LIMIT = 200; // requests per minute - generous for development
const GLOBAL_RATE_WINDOW = 60 * 1000; // 1 minute

export function globalRateLimiter(req: Request, res: Response, next: NextFunction) {
  // Skip rate limiting in development for better DX
  if (process.env.NODE_ENV !== "production") {
    return next();
  }
  
  // Skip rate limiting for static assets and Vite HMR
  if (
    req.path.startsWith("/assets") || 
    req.path.startsWith("/@") ||
    req.path.startsWith("/node_modules") ||
    req.path.endsWith(".js") || 
    req.path.endsWith(".css") ||
    req.path.endsWith(".map") ||
    req.path.endsWith(".ico") ||
    req.path.endsWith(".png") ||
    req.path.endsWith(".svg")
  ) {
    return next();
  }
  
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (record) {
    if (now >= record.resetAt) {
      requestCounts.set(ip, { count: 1, resetAt: now + GLOBAL_RATE_WINDOW });
    } else if (record.count >= GLOBAL_RATE_LIMIT) {
      return res.status(429).json({ 
        message: "Too many requests. Please slow down." 
      });
    } else {
      record.count++;
    }
  } else {
    requestCounts.set(ip, { count: 1, resetAt: now + GLOBAL_RATE_WINDOW });
  }
  
  next();
}

// Clean up old rate limit records periodically
setInterval(() => {
  const now = Date.now();
  requestCounts.forEach((record, ip) => {
    if (now >= record.resetAt) {
      requestCounts.delete(ip);
    }
  });
}, 60 * 1000);

// Input sanitization helpers
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, "");
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length to prevent DoS
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }
  
  return sanitized;
}

// Validate and sanitize phone numbers
export function sanitizePhone(phone: string): string {
  if (typeof phone !== "string") return "";
  // Remove everything except digits, +, -, (, ), and spaces
  return phone.replace(/[^\d+\-() ]/g, "").trim();
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Mask sensitive data for logging
export function maskSensitiveData(data: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    "password", "token", "secret", "key", "authorization",
    "ssn", "ssnLast4", "cardNumber", "cvv", "pin"
  ];
  
  const masked = { ...data };
  
  for (const field of sensitiveFields) {
    if (masked[field]) {
      masked[field] = "***REDACTED***";
    }
  }
  
  return masked;
}

// Audit logging for security events
export function auditLog(event: {
  type: "login" | "logout" | "failed_login" | "permission_denied" | "data_access" | "data_modification";
  userId?: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  details?: string;
}) {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT ${timestamp}] ${event.type.toUpperCase()} - User: ${event.userId || "anonymous"} - IP: ${event.ip || "unknown"} - Resource: ${event.resource || "N/A"} - ${event.details || ""}`);
}
