import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';
import './LoginOTP.css';

const LoginOTP: React.FC = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Focus first OTP input when OTP step is shown
  useEffect(() => {
    if (step === 'otp' && otpInputRefs.current[0]) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await authService.sendOTP(email);
      
      if (result.success) {
        setSuccess('OTP sent successfully! Please check your email.');
        setOtpSent(true);
        setTimeout(() => {
          setStep('otp');
          setSuccess('');
        }, 1500);
      } else {
        setError(result.message || 'Failed to send OTP');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedData[i] || '';
      }
      setOtp(newOtp);
      // Focus the last filled input or the last input
      const lastIndex = Math.min(pastedData.length - 1, 5);
      otpInputRefs.current[lastIndex]?.focus();
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      setLoading(false);
      return;
    }

    try {
      const result = await authService.verifyOTP(email, otpString);
      
      if (result.success) {
        // Update auth context
        const from = (location.state as any)?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
        // Reload to update auth state
        window.location.reload();
      } else {
        setError(result.message || 'Invalid OTP');
        // Clear OTP on error
        setOtp(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setOtp(['', '', '', '', '', '']);
    setError('');
    setSuccess('');
    setOtpSent(false);
  };

  return (
    <div className="login-container">
      {/* Animated Background */}
      <div className="login-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
        <div className="grid-pattern"></div>
      </div>

      {/* Login Card */}
      <div className="login-card-wrapper">
        <div className={`login-card ${step === 'otp' ? 'card-expanded' : ''}`}>
          {/* Logo Section */}
          <div className="logo-section">
            <div className="logo-container">
              <img 
                src="/assets/logo-white.png" 
                alt="Selab Nadiry Logo" 
                className="company-logo"
                onError={(e) => {
                  // Fallback to initials if logo fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.logo-fallback')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'logo-fallback';
                    fallback.textContent = 'SN';
                    parent.appendChild(fallback);
                  }
                }}
              />
              <div className="logo-fallback" style={{ display: 'none' }}>SN</div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="alert-message alert-error">
              <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="alert-message alert-success">
              <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Email Step */}
          {step === 'email' && (
            <form onSubmit={handleSendOTP} className="login-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address
                </label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    placeholder="Enter your email address"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? (
                  <span className="btn-loading">
                    <svg className="spinner" viewBox="0 0 24 24">
                      <circle className="spinner-circle" cx="12" cy="12" r="10" />
                    </svg>
                    Sending OTP...
                  </span>
                ) : (
                  <>
                    <span>Send OTP</span>
                    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="login-form">
              <div className="form-group">
                <label className="form-label text-center">
                  Enter 6-Digit OTP
                </label>
                <p className="otp-email-hint">
                  OTP sent to <span className="email-highlight">{email}</span>
                </p>
                <div className="otp-container" onPaste={handlePaste}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="otp-input"
                      disabled={loading}
                    />
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  disabled={loading}
                  className="btn-secondary"
                >
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? (
                    <span className="btn-loading">
                      <svg className="spinner" viewBox="0 0 24 24">
                        <circle className="spinner-circle" cx="12" cy="12" r="10" />
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    <>
                      <span>Verify OTP</span>
                      <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="login-footer">
            <p>&copy; {new Date().getFullYear()} Selab Nadiry Travel & Tourism. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginOTP;
