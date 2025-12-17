import { sign, verify } from 'hono/jwt';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { JWTPayload } from '../types';

const SALT_LENGTH = 16;
const ITERATIONS = 100000;

// Generate a random salt
function generateSalt(): string {
  const array = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(array);
  return bytesToHex(array);
}

// Hash password with salt using PBKDF2-like approach with SHA-256
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await deriveKey(password, salt);
  return `${salt}:${hash}`;
}

// Derive key from password and salt
async function deriveKey(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = hexToBytes(salt);
  
  // Use Web Crypto API for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  return bytesToHex(new Uint8Array(derivedBits));
}

// Verify password against stored hash
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  
  const derivedHash = await deriveKey(password, salt);
  return derivedHash === hash;
}

// Create JWT token
export async function createToken(
  userId: number,
  email: string,
  name: string | null,
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: userId.toString(),
    email,
    name,
    iat: now,
    exp: now + 30 * 24 * 60 * 60, // 30 days
  };
  
  return await sign(payload, secret);
}

// Verify JWT token
export async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const payload = await verify(token, secret) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

// Parse JWT from cookie header
export function getTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const authCookie = cookies.find(c => c.startsWith('auth_token='));
  
  if (!authCookie) return null;
  
  return authCookie.split('=')[1] || null;
}

// Create auth cookie string
export function createAuthCookie(token: string, maxAge: number = 30 * 24 * 60 * 60): string {
  return `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

// Create logout cookie (expires immediately)
export function createLogoutCookie(): string {
  return 'auth_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

