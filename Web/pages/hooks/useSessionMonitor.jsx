// hooks/useSessionMonitor.js
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useSessionMonitor = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = () => {
      try {
        // Don't check on login page
        if (window.location.pathname === '/') {
          return;
        }

        const sessionStr = localStorage.getItem('session');
        if (!sessionStr) {
          clearSession();
          navigate('/', { replace: true });
          return;
        }

        const session = JSON.parse(sessionStr);
        const now = new Date();
        const expiresAt = new Date(session.expiresAt);

        if (expiresAt < now) {
          clearSession();
          navigate('/', { replace: true });
          return;
        }

        // Update last activity
        session.lastActivity = now.toISOString();
        localStorage.setItem('session', JSON.stringify(session));

      } catch (error) {
        clearSession();
        navigate('/', { replace: true });
      }
    };

    const clearSession = () => {
      localStorage.removeItem('session');
      localStorage.removeItem('userData');
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
    };

    // Check immediately on mount
    checkSession();

    // Check every 60 seconds (was 10s).
    // Also removed mousedown/keydown listeners that fired checkSession on
    // EVERY user interaction — at 50000 users this caused massive unnecessary
    // localStorage reads and JSON.parse calls.
    const intervalId = setInterval(checkSession, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [navigate]);

  return null;
};