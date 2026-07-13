import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile } from '@/api/firebaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                           = useState(null);
  const [isAuthenticated, setIsAuthenticated]     = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]         = useState(true);
  // Kept for API compatibility with components that destructure these
  const [isLoadingPublicSettings]                 = useState(false);
  const [authError, setAuthError]                 = useState(null);
  const [appPublicSettings]                       = useState({ auth_required: false });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const profile = await getUserProfile(firebaseUser);
          setUser(profile);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
        setAuthError(null);
      } catch (err) {
        console.error('Auth state change error:', err);
        setAuthError({ type: 'unknown', message: err.message });
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = () => {
    import('firebase/auth').then(({ signOut }) => signOut(auth));
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    window.location.href = `${import.meta.env.BASE_URL}login`;
  };

  const checkAppState = () => {
    // Re-check by triggering a re-read of auth state (no-op in Firebase — handled by onAuthStateChanged)
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
