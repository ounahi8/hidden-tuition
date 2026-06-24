import React, { useState } from 'react';

const COLORS = {
  ink: "#1C2541", paper: "#FAF8F4", paperRaised: "#FFFFFF",
  slate: "#6B7280", border: "#E7E2D8",
};

export default function PasswordGate({ correctPassword, onUnlock }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (value === correctPassword) {
      sessionStorage.setItem('hiddens_tuition_unlocked', 'true');
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', width: '100%', alignItems: 'center', justifyContent: 'center',
    }}>
      <form onSubmit={submit} style={{
        background: COLORS.paperRaised, border: `1px solid ${COLORS.border}`, borderRadius: 14,
        padding: '32px 28px', width: 320, textAlign: 'center',
      }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: COLORS.ink, marginBottom: 4 }}>
          Hidden's Tuition
        </div>
        <div style={{ fontSize: 13, color: COLORS.slate, marginBottom: 20 }}>
          Enter the admin password to continue
        </div>
        <input
          type="password"
          className="input"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          placeholder="Password"
          style={{ marginBottom: 12, textAlign: 'center' }}
        />
        {error && (
          <div style={{ fontSize: 12.5, color: '#9A3412', marginBottom: 12 }}>
            That password isn't right — try again.
          </div>
        )}
        <button type="submit" className="btn-primary" style={{ width: '100%' }}>
          Unlock
        </button>
      </form>
    </div>
  );
}
