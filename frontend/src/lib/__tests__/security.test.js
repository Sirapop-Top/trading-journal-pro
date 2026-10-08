import { describe, it, expect } from 'vitest';
import { generateSalt, hashPasscode, verifyPasscode, migrateLegacyPasscode } from '../security.js';

describe('Security - Passcode Hashing and Verification', () => {
  it('generates a 32-character hex salt from 16 bytes', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).toHaveLength(32);
    expect(salt2).toHaveLength(32);
    expect(salt1).not.toBe(salt2);
  });

  it('hashes passcode deterministically given the same salt and pin', async () => {
    const salt = 'aabbccddeeff00112233445566778899';
    const pin = '1234';
    const hash1 = await hashPasscode(pin, salt);
    const hash2 = await hashPasscode(pin, salt);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
  });

  it('produces different hashes for different pins or salts', async () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const hash1 = await hashPasscode('1234', salt1);
    const hash2 = await hashPasscode('1234', salt2);
    const hash3 = await hashPasscode('5678', salt1);

    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('verifies correct passcode and rejects incorrect passcode', async () => {
    const salt = generateSalt();
    const pin = '9999';
    const hash = await hashPasscode(pin, salt);

    const matchValid = await verifyPasscode('9999', hash, salt);
    const matchInvalid = await verifyPasscode('1111', hash, salt);

    expect(matchValid).toBe(true);
    expect(matchInvalid).toBe(false);
  });

  it('migrates legacy plaintext passcode in localStorage', async () => {
    localStorage.clear();
    localStorage.setItem('alphatrader_passcode', '1234');

    const migrated = await migrateLegacyPasscode();
    expect(migrated).toBe(true);
    expect(localStorage.getItem('alphatrader_passcode')).toBeNull();

    const storedHash = localStorage.getItem('alphatrader_passcode_hash');
    const storedSalt = localStorage.getItem('alphatrader_passcode_salt');
    expect(storedHash).toBeTruthy();
    expect(storedSalt).toBeTruthy();

    const verify = await verifyPasscode('1234', storedHash, storedSalt);
    expect(verify).toBe(true);
  });
});
