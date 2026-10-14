import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  generateSalt,
  hashPasscode,
  verifyPasscode,
  migrateLegacyPasscode
} from '../lib/security.js';

export const usePasscodeLock = () => {
  const [appPasscode, setAppPasscode] = useState('');
  const [hasPasscode, setHasPasscode] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return !!(localStorage.getItem('alphatrader_passcode_hash') || localStorage.getItem('alphatrader_passcode'));
  });
  const [isLocked, setIsLocked] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return !!(localStorage.getItem('alphatrader_passcode_hash') || localStorage.getItem('alphatrader_passcode'));
  });
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);
  const [enteredPasscode, setEnteredPasscode] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(() => {
    if (typeof localStorage === 'undefined') return 0;
    return Number(localStorage.getItem('alphatrader_autolock') || '0');
  });

  // Migrate legacy plaintext passcode on initial startup
  useEffect(() => {
    migrateLegacyPasscode().then(migrated => {
      if (migrated) {
        setHasPasscode(true);
      }
    });
  }, []);

  // Lockout Timer Cooldown
  useEffect(() => {
    if (lockoutTimeRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTimeRemaining]);

  // Idle Timer Auto-Lock
  useEffect(() => {
    if (!hasPasscode || autoLockMinutes <= 0 || isLocked) return;

    let timeoutId;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
        message.warning('App locked automatically due to inactivity.');
      }, autoLockMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [hasPasscode, autoLockMinutes, isLocked]);

  const handleUnlock = useCallback(async () => {
    if (lockoutTimeRemaining > 0) return;
    const storedHash = localStorage.getItem('alphatrader_passcode_hash');
    const storedSalt = localStorage.getItem('alphatrader_passcode_salt');
    const legacyPass = localStorage.getItem('alphatrader_passcode');

    let isValid = false;
    if (storedHash && storedSalt) {
      isValid = await verifyPasscode(enteredPasscode, storedHash, storedSalt);
    } else if (legacyPass) {
      isValid = (enteredPasscode === legacyPass);
      if (isValid) {
        const salt = generateSalt();
        const hash = await hashPasscode(legacyPass, salt);
        localStorage.setItem('alphatrader_passcode_hash', hash);
        localStorage.setItem('alphatrader_passcode_salt', salt);
        localStorage.removeItem('alphatrader_passcode');
      }
    }

    if (isValid) {
      setIsLocked(false);
      setFailedAttempts(0);
      setEnteredPasscode('');
      message.success('Welcome back!');
    } else {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      setEnteredPasscode('');
      if (attempts >= 5) {
        setLockoutTimeRemaining(60);
        message.error('Too many failed attempts. Locked out for 60 seconds.');
      } else {
        message.error(`Incorrect passcode. ${5 - attempts} attempts remaining.`);
      }
    }
  }, [enteredPasscode, failedAttempts, lockoutTimeRemaining]);

  const handleSaveSecuritySettings = useCallback(async (newPin, newAutoLock) => {
    if (newPin && newPin.trim()) {
      const salt = generateSalt();
      const hash = await hashPasscode(newPin.trim(), salt);
      localStorage.setItem('alphatrader_passcode_hash', hash);
      localStorage.setItem('alphatrader_passcode_salt', salt);
      localStorage.removeItem('alphatrader_passcode');
      setHasPasscode(true);
      setAppPasscode(newPin.trim());
    }
    const autoVal = newAutoLock !== undefined ? newAutoLock : autoLockMinutes;
    localStorage.setItem('alphatrader_autolock', autoVal.toString());
    setAutoLockMinutes(autoVal);
    message.success('Security settings saved successfully!');
  }, [autoLockMinutes]);

  const handleDisablePasscode = useCallback(() => {
    setAppPasscode('');
    setHasPasscode(false);
    localStorage.removeItem('alphatrader_passcode');
    localStorage.removeItem('alphatrader_passcode_hash');
    localStorage.removeItem('alphatrader_passcode_salt');
    message.success('Passcode lock disabled.');
  }, []);

  const handleClearAllSecurity = useCallback(() => {
    localStorage.removeItem('alphatrader_passcode');
    localStorage.removeItem('alphatrader_passcode_hash');
    localStorage.removeItem('alphatrader_passcode_salt');
    localStorage.removeItem('alphatrader_autolock');
    setAppPasscode('');
    setHasPasscode(false);
    setIsLocked(false);
  }, []);

  return {
    appPasscode,
    setAppPasscode,
    hasPasscode,
    setHasPasscode,
    isLocked,
    setIsLocked,
    failedAttempts,
    lockoutTimeRemaining,
    enteredPasscode,
    setEnteredPasscode,
    autoLockMinutes,
    setAutoLockMinutes,
    handleUnlock,
    handleSaveSecuritySettings,
    handleDisablePasscode,
    handleClearAllSecurity
  };
};
