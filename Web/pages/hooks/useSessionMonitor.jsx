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
          console.log("No session found");
          clearSession();
          navigate('/', { replace: true });
          return;
        }

        const session = JSON.parse(sessionStr);
        const now = new Date();
        const expiresAt = new Date(session.expiresAt);
        
        if (expiresAt < now) {
          console.log("Session expired");
          clearSession();
          navigate('/', { replace: true });
          return;
        }

        // Update last activity
        session.lastActivity = now.toISOString();
        localStorage.setItem('session', JSON.stringify(session));

      } catch (error) {
        console.error("Session monitor error:", error);
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

    // Check immediately
    checkSession();

    // Check every 10 seconds
    const intervalId = setInterval(checkSession, 10000);

    // Check on user activity
    const handleUserActivity = () => {
      checkSession();
    };

    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [navigate]);

  return null;
};