/**
 * AuthView Component
 *
 * Login form for unauthenticated users
 * Phase 1: JWT Authentication
 */

import React, { useState } from 'react';
import { apiClient, APIError, AuthError } from '@/lib/api/api-client';

interface AuthViewProps {
  onLoginSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiClient.login(email, password);

      // Login successful, notify parent
      onLoginSuccess();
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else if (err instanceof AuthError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
      console.error('[AuthView] Login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupClick = () => {
    // Open web app for full signup flow
    const signupUrl =
      process.env.API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:3000';
    chrome.tabs.create({
      url: `${signupUrl}/signup?source=extension`,
    });
  };

  const handleForgotPassword = () => {
    const baseUrl =
      process.env.API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:3000';
    chrome.tabs.create({
      url: `${baseUrl}/password/new`,
    });
  };

  return (
    <div className="auth-view" data-testid="auth-view" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
          Sign In to YTGify
        </h2>
        <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.5' }}>
          Upload your GIFs to the cloud and access social features
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleLogin} data-testid="login-form" style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="email"
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '6px',
            }}
          >
            Email
          </label>
          <input
            id="email"
            data-testid="email-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="password"
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '6px',
            }}
          >
            Password
          </label>
          <input
            id="password"
            data-testid="password-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div
            data-testid="error-message"
            style={{
              padding: '12px',
              marginBottom: '16px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '6px',
              color: '#c33',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          data-testid="login-submit-btn"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '15px',
            fontWeight: '600',
            color: '#fff',
            backgroundColor: loading ? '#999' : '#6366f1',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Forgot Password */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <button
          onClick={handleForgotPassword}
          data-testid="forgot-password-link"
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            color: '#6366f1',
            fontSize: '14px',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Forgot password?
        </button>
      </div>

      {/* Divider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          margin: '20px 0',
          color: '#999',
          fontSize: '14px',
        }}
      >
        <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }} />
        <span style={{ padding: '0 12px' }}>or</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }} />
      </div>

      {/* Sign Up Prompt */}
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
          Don&apos;t have an account?
        </p>
        <button
          onClick={handleSignupClick}
          data-testid="create-account-btn"
          disabled={loading}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#6366f1',
            backgroundColor: '#fff',
            border: '1px solid #6366f1',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          Create Account
        </button>
      </div>

      {/* Benefits */}
      <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
          With a YTGify account:
        </p>
        <ul style={{ fontSize: '13px', color: '#6b7280', listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: '#6366f1',
                fontWeight: 'bold',
              }}
            >
              ✓
            </span>
            Upload GIFs to the cloud
          </li>
          <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: '#6366f1',
                fontWeight: 'bold',
              }}
            >
              ✓
            </span>
            Share GIFs with the community
          </li>
          <li style={{ marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: '#6366f1',
                fontWeight: 'bold',
              }}
            >
              ✓
            </span>
            Like and comment on GIFs
          </li>
          <li style={{ paddingLeft: '20px', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: '#6366f1',
                fontWeight: 'bold',
              }}
            >
              ✓
            </span>
            Follow other creators
          </li>
        </ul>
      </div>
    </div>
  );
};
