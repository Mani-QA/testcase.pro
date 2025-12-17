// Script to generate a password hash for seed data
// Run with: npx tsx scripts/reset-password.ts

async function hashPassword(password: string): Promise<string> {
  const SALT_LENGTH = 16;
  const ITERATIONS = 100000;
  
  // Generate salt
  const saltArray = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(saltArray);
  const salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Derive key using PBKDF2
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = new Uint8Array(salt.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
  
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
  
  const hash = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

async function main() {
  const password = '#Case2025';
  const hash = await hashPassword(password);
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nSQL to insert/update user:');
  console.log(`INSERT OR REPLACE INTO users (id, email, password_hash, full_name) VALUES (1, 'admin@testcasepro.com', '${hash}', 'Admin User');`);
}

main();

