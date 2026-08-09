import React from 'react';

// Catches render-time errors anywhere in the tree and shows the real error
// message on-screen instead of a blank page — this app has no dev-tools-savvy
// way to diagnose a white/black screen otherwise.
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return <CrashScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}

export function CrashScreen({ error }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#1a0000', color: '#fff', fontFamily: 'monospace', padding: 24,
    }}>
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ color: '#ff6666', fontSize: 20, marginBottom: 12 }}>App failed to start</h1>
        <pre style={{
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13,
          background: '#000', padding: 12, borderRadius: 8, border: '1px solid #440000',
        }}>
          {String(error?.message || error)}
        </pre>
        <p style={{ marginTop: 16, fontSize: 12, color: '#aaa' }}>
          Screenshot or copy this text and send it back — it tells us exactly what's wrong.
        </p>
      </div>
    </div>
  );
}
