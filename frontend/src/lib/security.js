/**
 * Security utilities for AlphaTrader.
 * Implements salted SHA-256 hashing for user passcodes via Web Crypto API.
 */

/**
 * Generate a cryptographically secure random hex salt.
 * @param {number} byteLength - Number of random bytes (default 16 = 32 hex chars)
 * @returns {string} Hex-encoded salt
 */
export const generateSalt = (byteLength = 16) => {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for non-standard environments
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Hash a passcode with a salt using SHA-256.
 * @param {string} pin - User plaintext PIN/passcode
 * @param {string} salt - Hex-encoded salt
 * @returns {Promise<string>} Hex-encoded SHA-256 digest
 */
export const hashPasscode = async (pin, salt) => {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Verify a plaintext PIN against a stored hash and salt.
 * @param {string} pin - Input PIN to verify
 * @param {string} storedHash - Stored hex hash
 * @param {string} salt - Stored hex salt
 * @returns {Promise<boolean>} True if match
 */
export const verifyPasscode = async (pin, storedHash, salt) => {
  if (!pin || !storedHash || !salt) return false;
  const computed = await hashPasscode(pin, salt);
  return computed === storedHash;
};

/**
 * Migrate legacy plaintext passcode in localStorage to salted SHA-256.
 * Removes 'alphatrader_passcode' and sets 'alphatrader_passcode_hash' + 'alphatrader_passcode_salt'.
 * @returns {Promise<boolean>} True if migration occurred
 */
export const migrateLegacyPasscode = async () => {
  if (typeof localStorage === 'undefined') return false;
  const legacyPin = localStorage.getItem('alphatrader_passcode');
  if (legacyPin) {
    const salt = generateSalt();
    const hash = await hashPasscode(legacyPin, salt);
    localStorage.setItem('alphatrader_passcode_hash', hash);
    localStorage.setItem('alphatrader_passcode_salt', salt);
    localStorage.removeItem('alphatrader_passcode');
    return true;
  }
  return false;
};
