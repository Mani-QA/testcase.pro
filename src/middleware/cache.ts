import { Context, Next } from 'hono';
import type { Bindings } from '../types';

// Cache TTL configurations (in seconds)
export const CacheTTL = {
  // Static assets - cache for 1 year (immutable content)
  STATIC: 31536000,
  // Public pages (auth pages) - cache for 1 hour
  PUBLIC_PAGE: 3600,
  // Dashboard stats API - cache for 5 minutes  
  DASHBOARD_STATS: 300,
  // List APIs (test cases, suites, folders) - cache for 2 minutes
  LIST_API: 120,
  // Individual item APIs - cache for 1 minute
  ITEM_API: 60,
  // Pages requiring auth - cache for 1 minute per user
  PRIVATE_PAGE: 60,
} as const;

/**
 * Edge Cache Middleware using Cloudflare Cache API
 * 
 * This middleware caches responses at Cloudflare's edge to reduce Worker invocations.
 * - Uses the Cache API (cf.cache) for edge caching
 * - Respects Cache-Control headers
 * - Supports cache bypass for authenticated mutations
 */
export const edgeCacheMiddleware = (ttl: number, options?: {
  cacheControl?: string;
  varyBy?: string[];
  bypassMethods?: string[];
}) => {
  const bypassMethods = options?.bypassMethods ?? ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const request = c.req.raw;
    
    // Skip caching for mutation methods
    if (bypassMethods.includes(request.method)) {
      return next();
    }
    
    // Create a cache key based on URL and optional vary headers
    const cacheUrl = new URL(request.url);
    const varyParts: string[] = [cacheUrl.toString()];
    
    if (options?.varyBy) {
      for (const header of options.varyBy) {
        const value = request.headers.get(header);
        if (value) {
          varyParts.push(`${header}:${value}`);
        }
      }
    }
    
    const cacheKey = new Request(varyParts.join('|'), {
      method: 'GET',
      headers: request.headers,
    });
    
    // Try to get from cache
    const cache = caches.default;
    let cachedResponse = await cache.match(cacheKey);
    
    if (cachedResponse) {
      // Clone the response and add cache hit header
      const response = new Response(cachedResponse.body, cachedResponse);
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('X-Cache-Age', cachedResponse.headers.get('Age') || '0');
      return response;
    }
    
    // Execute the handler
    await next();
    
    // Get the response
    const response = c.res;
    
    // Only cache successful responses
    if (response.status === 200) {
      const cacheControl = options?.cacheControl ?? 
        `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${Math.floor(ttl / 2)}`;
      
      // Clone the response for caching
      const responseToCache = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      });
      
      responseToCache.headers.set('Cache-Control', cacheControl);
      responseToCache.headers.set('X-Cache', 'MISS');
      
      // Store in edge cache (non-blocking)
      c.executionCtx.waitUntil(cache.put(cacheKey, responseToCache.clone()));
      
      // Return the response with cache headers
      c.res = responseToCache;
    }
  };
};

/**
 * Static Asset Cache - Long TTL for immutable content
 */
export const staticCacheMiddleware = edgeCacheMiddleware(CacheTTL.STATIC, {
  cacheControl: `public, max-age=${CacheTTL.STATIC}, immutable`,
});

/**
 * API Cache - Short TTL with stale-while-revalidate
 */
export const apiCacheMiddleware = (ttl: number = CacheTTL.LIST_API) => 
  edgeCacheMiddleware(ttl, {
    cacheControl: `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
  });

/**
 * User-specific cache - Varies by auth cookie
 */
export const userCacheMiddleware = (ttl: number = CacheTTL.PRIVATE_PAGE) =>
  edgeCacheMiddleware(ttl, {
    varyBy: ['Cookie'],
    cacheControl: `private, max-age=${ttl}, stale-while-revalidate=${Math.floor(ttl / 2)}`,
  });

/**
 * Helper to set cache headers without full middleware
 */
export const setCacheHeaders = (c: Context, ttl: number, options?: {
  isPrivate?: boolean;
  immutable?: boolean;
  staleWhileRevalidate?: number;
}) => {
  const directives: string[] = [];
  
  if (options?.isPrivate) {
    directives.push('private');
  } else {
    directives.push('public');
  }
  
  directives.push(`max-age=${ttl}`);
  
  if (!options?.isPrivate) {
    directives.push(`s-maxage=${ttl}`);
  }
  
  if (options?.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  } else if (ttl > 60) {
    directives.push(`stale-while-revalidate=${Math.floor(ttl / 2)}`);
  }
  
  if (options?.immutable) {
    directives.push('immutable');
  }
  
  c.header('Cache-Control', directives.join(', '));
};

/**
 * Helper to invalidate cache for a specific path
 */
export const invalidateCache = async (url: string) => {
  const cache = caches.default;
  const cacheKey = new Request(url, { method: 'GET' });
  await cache.delete(cacheKey);
};

/**
 * Middleware to purge cache on mutations
 */
export const cachePurgeMiddleware = (pathsToPurge: string[]) => {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    await next();
    
    // Only purge on successful mutations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(c.req.method) && c.res.status < 300) {
      const baseUrl = new URL(c.req.url).origin;
      const cache = caches.default;
      
      // Purge related cache entries
      const purgePromises = pathsToPurge.map(path => {
        const cacheKey = new Request(`${baseUrl}${path}`, { method: 'GET' });
        return cache.delete(cacheKey);
      });
      
      c.executionCtx.waitUntil(Promise.all(purgePromises));
    }
  };
};

