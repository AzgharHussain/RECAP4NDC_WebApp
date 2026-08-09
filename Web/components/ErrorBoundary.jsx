import React from 'react';

/**
 * ErrorBoundary — Catches React render errors and shows a fallback UI
 * instead of a white screen. Place it around route-level components.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center',
          fontFamily: "'Inter', 'Arial', sans-serif",
          backgroundColor: '#f8f9fa',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '40px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            maxWidth: '500px',
            width: '100%',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ margin: '0 0 12px', fontSize: '22px', color: '#333' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#666', fontSize: '15px', marginBottom: '24px' }}>
              An unexpected error occurred. Try reloading the page or going back home.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#2e7d32',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'white',
                  color: '#2e7d32',
                  border: '2px solid #2e7d32',
                  borderRadius: '8px',
                  fontSize: '15px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Go Home
              </button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <details style={{
                marginTop: '20px',
                textAlign: 'left',
                fontSize: '13px',
                color: '#999',
                maxHeight: '200px',
                overflow: 'auto',
              }}>
                <summary>Error details (dev only)</summary>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error?.toString()}
                  {'\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
