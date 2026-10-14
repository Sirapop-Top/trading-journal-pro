import { Card, Input, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';

export const LockScreen = () => {
  const {
    enteredPasscode,
    setEnteredPasscode,
    lockoutTimeRemaining,
    handleUnlock
  } = useAppData();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #0b0e17 0%, #06080f 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'rgba(0, 242, 254, 0.04)',
        filter: 'blur(80px)',
        top: '10%',
        left: '20%'
      }}></div>
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'rgba(123, 92, 246, 0.04)',
        filter: 'blur(80px)',
        bottom: '10%',
        right: '20%'
      }}></div>

      <Card
        bordered={false}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'rgba(11, 14, 23, 0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
          borderRadius: '16px',
          textAlign: 'center',
          padding: '24px 16px'
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(0, 242, 254, 0.1)',
            border: '1px solid rgba(0, 242, 254, 0.2)',
            boxShadow: '0 0 15px rgba(0, 242, 254, 0.1)',
            color: 'var(--primary-color)',
            fontSize: '28px',
            marginBottom: '16px'
          }}>
            <LockOutlined />
          </div>
          <h2 style={{ color: '#ffffff', margin: '0 0 8px 0', fontFamily: 'var(--font-family-ui)', fontWeight: 800, letterSpacing: '0.5px' }}>
            ALPHA<span style={{ color: 'var(--primary-color)' }}>TRADER</span> SECURED
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
            This terminal is locked. Please enter your passcode to access.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input.Password
            placeholder="Enter passcode"
            size="large"
            value={enteredPasscode}
            onChange={(e) => setEnteredPasscode(e.target.value)}
            onPressEnter={handleUnlock}
            disabled={lockoutTimeRemaining > 0}
            style={{
              textAlign: 'center',
              letterSpacing: '4px',
              fontSize: '18px',
              background: 'rgba(6, 8, 15, 0.5)',
              border: '1px solid var(--border-color)',
              color: '#ffffff'
            }}
            autoFocus
          />

          <Button
            type="primary"
            size="large"
            disabled={lockoutTimeRemaining > 0}
            onClick={handleUnlock}
            style={{
              background: 'var(--accent-gradient)',
              border: 'none',
              color: '#06080f',
              fontWeight: 'bold',
              fontSize: '15px',
              height: '44px',
              borderRadius: '8px'
            }}
          >
            Unlock Terminal
          </Button>

          {lockoutTimeRemaining > 0 && (
            <div style={{
              color: 'var(--danger-color)',
              fontSize: '12px',
              fontWeight: 'bold',
              background: 'rgba(244, 63, 94, 0.08)',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid rgba(244, 63, 94, 0.2)'
            }}>
              Too many incorrect attempts. Locked out for {lockoutTimeRemaining}s
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
