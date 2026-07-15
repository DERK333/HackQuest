import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({ auth_required: true });

  useEffect(() => {
    const initAuth = async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (authed) {
          try {
            const me = await base44.auth.me();
            setUser(me);
            setIsAuthenticated(true);
          } catch (err) {
            if (err?.status === 403) {
              setAuthError({ type: 'user_not_registered' });
            } else {
              throw err;
            }
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        setAuthError({ type: 'unknown', message: err?.message });
      } finally {
        setIsLoadingAuth(false);
        setIsLoadingPublicSettings(false);
      }
    };
    initAuth();
  }, []);

  const logout = (redirectUrl) => {
    base44.auth.logout(redirectUrl);
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = (nextUrl) => {
    base44.auth.redirectToLogin(nextUrl);
  };

  const checkAppState = async () => {
    // Re-check would require re-running init; platform handles token refresh
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};