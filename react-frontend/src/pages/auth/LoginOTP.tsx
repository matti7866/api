import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';
import { cn } from '../../lib/utils';
import './LoginOTP.css';

const LoginOTP: React.FC = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ name: string; picture?: string } | null>(null);
  
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
        setOtpSent(true);
        if (result.staff) {
          setStaffInfo(result.staff);
        }
        setStep('otp');
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
    setStaffInfo(null);
  };

  return (
    <div className="login-surprise-container">
      {/* Animated gradient background */}
      <div className="login-surprise-bg" />
      
      {/* Floating shapes */}
      <div className="login-surprise-orb login-surprise-orb-1" />
      <div className="login-surprise-orb login-surprise-orb-2" />
      <div className="login-surprise-orb login-surprise-orb-3" />
      
      {/* Glass morphism container */}
      <div className="login-surprise-card-wrapper">
        <div className="login-surprise-card-glow" />
        
        <div className={cn("login-surprise-card", step === 'otp' && "login-surprise-card-expanded")}>
          {/* Logo/Header */}
          <div className="login-surprise-header">
            {step === 'email' ? (
              <>
                <img 
                  src="/assets/logo-white.png" 
                  alt="Selab Nadiry Logo" 
                  className="login-surprise-logo-img"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.login-surprise-logo-fallback')) {
                      const fallback = document.createElement('div');
                      fallback.className = 'login-surprise-logo-fallback';
                      fallback.textContent = 'SN';
                      parent.appendChild(fallback);
                    }
                  }}
                />
                <div className="login-surprise-logo-fallback" style={{ display: 'none' }}>SN</div>
              </>
            ) : (
              <>
                {staffInfo?.picture && staffInfo.picture !== 'null' && staffInfo.picture !== '' ? (
                  <img 
                    src={staffInfo.picture} 
                    alt={staffInfo.name}
                    className="login-surprise-staff-img"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.login-surprise-staff-fallback')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'login-surprise-staff-fallback';
                        fallback.textContent = staffInfo?.name?.charAt(0) || 'U';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div className="login-surprise-staff-fallback">
                    {staffInfo?.name?.charAt(0) || 'U'}
                  </div>
                )}
                {staffInfo?.name && (
                  <h2 className="login-surprise-staff-name">{staffInfo.name}</h2>
                )}
              </>
            )}
            <h1 className="login-surprise-title">
              {step === 'email' ? 'Welcome Back' : 'Enter OTP'}
            </h1>
            <p className="login-surprise-subtitle">
              {step === 'email' ? 'Sign in to continue your journey' : 'We sent a code to your email'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="login-surprise-error">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="login-surprise-success">
              <i className="fas fa-check-circle"></i>
              <span>{success}</span>
            </div>
          )}

          {/* Email Step */}
          {step === 'email' && (
            <form onSubmit={handleSendOTP} className="login-surprise-form">
              <div className="login-surprise-input-group">
                <div className={cn(
                  "login-surprise-input-glow",
                  emailFocused && "login-surprise-input-glow-active"
                )} />
                <div className="login-surprise-input-wrapper">
                  <i className={cn(
                    "fas fa-envelope login-surprise-input-icon",
                    emailFocused && "login-surprise-input-icon-active"
                  )} />
                  <input
                    id="email"
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    className="login-surprise-input"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="login-surprise-submit"
              >
                <span className="login-surprise-submit-content">
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Send OTP
                      <i className="fas fa-arrow-right ml-2"></i>
                    </>
                  )}
                </span>
                <div className="login-surprise-submit-glow" />
              </button>
            </form>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="login-surprise-form">
              <div className="login-surprise-otp-group">
                <p className="login-surprise-otp-hint">
                  OTP sent to <span className="login-surprise-otp-email">{email}</span>
                </p>
                <div className="login-surprise-otp-container" onPaste={handlePaste}>
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
                      className="login-surprise-otp-input"
                      disabled={loading}
                    />
                  ))}
                </div>
              </div>

              <div className="login-surprise-form-actions">
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  disabled={loading}
                  className="login-surprise-submit login-surprise-submit-secondary"
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="login-surprise-submit"
                >
                  <span className="login-surprise-submit-content">
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify OTP
                        <i className="fas fa-check ml-2"></i>
                      </>
                    )}
                  </span>
                  <div className="login-surprise-submit-glow" />
                </button>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="login-surprise-footer">
            <p>&copy; {new Date().getFullYear()} Selab Nadiry Travel & Tourism. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginOTP;
