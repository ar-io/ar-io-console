/**
 * Hot Wallet Encryption Utilities
 *
 * Provides encryption/decryption for hot wallet mnemonics stored in localStorage.
 * Uses Web Crypto API with AES-GCM encryption and PBKDF2 key derivation.
 *
 * Security model:
 * - Wallet generated with cryptographically secure randomness (crypto.getRandomValues)
 * - Encrypted data stored in localStorage (persists across sessions)
 * - User can explicitly disconnect to clear the wallet
 * - Mnemonic never stored in plaintext
 */

const APP_SECRET = 'turbo-gateway-hot-wallet-v1';
const STORAGE_KEY = 'turbo-hot-wallet';

export interface EncryptedWallet {
  encryptedMnemonic: string; // Base64 encoded encrypted mnemonic
  iv: string; // Base64 encoded initialization vector
  address: string; // Public wallet address (not encrypted)
  seedExported: boolean; // Has user exported the seed phrase?
  createdAt: number; // Timestamp when wallet was created
}

/**
 * Derives a deterministic encryption key from app secret and origin.
 * Same key is derived on every page load, allowing decryption after refresh.
 */
async function deriveEncryptionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  // Import the raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(APP_SECRET + window.location.origin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('turbo-hot-wallet-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a mnemonic and stores it in localStorage.
 */
export async function encryptAndStoreMnemonic(
  mnemonic: string,
  address: string
): Promise<void> {
  const key = await deriveEncryptionKey();
  const encoder = new TextEncoder();

  // Generate random IV for this encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the mnemonic
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(mnemonic)
  );

  // Store as base64 in localStorage
  const data: EncryptedWallet = {
    encryptedMnemonic: arrayBufferToBase64(encrypted),
    iv: uint8ArrayToBase64(iv),
    address,
    seedExported: false,
    createdAt: Date.now(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Decrypts and returns the mnemonic from localStorage.
 * Returns null if no wallet is stored or decryption fails.
 */
export async function decryptMnemonic(): Promise<string | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    const data: EncryptedWallet = JSON.parse(stored);
    const key = await deriveEncryptionKey();

    const iv = base64ToUint8Array(data.iv);
    const encrypted = base64ToUint8Array(data.encryptedMnemonic);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encrypted as BufferSource
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Failed to decrypt hot wallet:', error);
    return null;
  }
}

/**
 * Gets the stored hot wallet metadata (without decrypting the mnemonic).
 */
export function getStoredHotWallet(): EncryptedWallet | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Marks the seed phrase as exported in localStorage.
 */
export function markSeedExported(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return;

  try {
    const data: EncryptedWallet = JSON.parse(stored);
    data.seedExported = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore parse errors
  }
}

/**
 * Clears the hot wallet from localStorage.
 */
export function clearHotWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Checks if the seed phrase has been exported.
 */
export function isSeedExported(): boolean {
  const data = getStoredHotWallet();
  return data?.seedExported ?? false;
}

/**
 * Gets the stored hot wallet address (if any).
 */
export function getStoredHotWalletAddress(): string | null {
  const data = getStoredHotWallet();
  return data?.address ?? null;
}

// Base64 encoding/decoding helpers
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return uint8ArrayToBase64(bytes);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
