// components/ProtectedRoute.jsx
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  useEffect(() => {
    // Check session every 5 seconds
    const interval = setInterval(() => {
      const sessionStr = localStorage.getItem('session');
      
      if (!sessionStr) {
        // No session, redirect immediately
        clearInterval(interval);
        window.location.href = '/';
        return;
      }
      
      try {
        const session = JSON.parse(sessionStr);
        const now = new Date();
        const expiresAt = new Date(session.expiresAt);
        
        if (expiresAt < now) {
          // Session expired
          localStorage.clear();
          clearInterval(interval);
          window.location.href = '/';
        }
      } catch (error) {
        localStorage.clear();
        clearInterval(interval);
        window.location.href = '/';
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Check session on initial load
  const sessionStr = localStorage.getItem('session');
  
  if (!sessionStr) {
    return <Navigate to="/" replace />;
  }
  
  try {
    const session = JSON.parse(sessionStr);
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    
    if (expiresAt < now) {
      localStorage.clear();
      return <Navigate to="/" replace />;
    }
    
    return children;
  } catch (error) {
    localStorage.clear();
    return <Navigate to="/" replace />;
  }
};

export default ProtectedRoute;