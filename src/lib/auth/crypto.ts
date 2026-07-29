import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Encrypt Shopify access tokens before storing in Neon. TOKEN_ENC_KEY is a
// 32-byte hex string (openssl rand -hex 32). Format stored: iv:tag:ciphertext
// all hex-encoded.

const KEY = Buffer.from(process.env.TOKEN_ENC_KEY ?? '', 'hex');

function assertKey() {
  if (KEY.length !== 32) {
    throw new Error(
      'TOKEN_ENC_KEY must be a 32-byte hex string. Generate: openssl rand -hex 32'
    );
  }
}

export function encrypt(plain: string): string {
  assertKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(payload: string): string {
  assertKey();
  const [ivHex, tagHex, dataHex] = payload.split(':');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    KEY,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
