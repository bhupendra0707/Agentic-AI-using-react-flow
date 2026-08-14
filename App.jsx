import React, { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import WorkflowCanvas from './WorkflowCanvas';

function decodeJwtResponse(token) {
  try {
    const base64Url = token.split('.');
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("Failed to decode token", err);
    return null;
  }
}

export default function App() {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scriptError, setScriptError] = useState(false);

  const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_://googleusercontent.com";

  const handleCredentialResponse = (response) => {
    setLoading(true);
    const profileData = decodeJwtResponse(response.credential);
    
    if (profileData) {
      const userSession = {
        name: profileData.name,
        email: profileData.email,
        picture: profileData.picture,
        token: response.credential
      };
      localStorage.setItem('google_user_profile', JSON.stringify(userSession));
      setUserProfile(userSession);
    }
    setLoading(false);
  };

  // Mock Developer Quick Login Bypass 🚀
  const handleDeveloperBypass = () => {
    const devSession = {
      name: "Developer Admin",
      email: "dev@local.internal",
      picture: "https://dicebear.com", // Dynamic generic avatar string
      token: "mock_jwt_token_payload"
    };
    localStorage.setItem('google_user_profile', JSON.stringify(devSession));
    setUserProfile(devSession);
  };

  useEffect(() => {
    const cachedProfile = localStorage.getItem('google_user_profile');
    if (cachedProfile) {
      setUserProfile(JSON.parse(cachedProfile));
      setLoading(false);
      return;
    }

    const renderGoogleButton = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false
        });

        const targetDiv = document.getElementById("googleButtonContainer");
        if (targetDiv) {
          window.google.accounts.id.renderButton(targetDiv, {
            theme: "outline",
            size: "large",
            width: 280
          });
        }
        setLoading(false);
      }
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      let attempts = 0;
      const checkScriptInterval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.id) {
          renderGoogleButton();
          clearInterval(checkScriptInterval);
        } else if (attempts >= 10) { // Timeout quicker (2 seconds)
          clearInterval(checkScriptInterval);
          setScriptError(true);
          setLoading(false);
        }
      }, 200);
      
      return () => clearInterval(checkScriptInterval);
    }
  }, []);

  const handleLogoutTrigger = () => {
    localStorage.removeItem('google_user_profile');
    setUserProfile(null);
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100vw', height: '100vh', background: '#f4f4f7', fontFamily: 'sans-serif' }}>
        <h2>Loading Agentic Security Session... ⏳</h2>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100vw', height: '100vh', background: '#e9ecef', fontFamily: 'sans-serif' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', width: '360px', textAlign: 'center' }}>
          <h2 style={{ color: '#444', margin: '0 0 5px 0' }}>⚡ Agentic Studio</h2>
          <p style={{ color: '#777', fontSize: '13px', margin: '0 0 30px 0' }}>Sign in to configure AI workflows</p>
          
          <div id="googleButtonContainer" style={{ display: 'flex', justifyContent: 'center', width: '100%', minHeight: '40px' }}></div>
          
          {scriptError && (
            <div style={{ marginTop: '15px' }}>
              <div style={{ fontSize: '11px', color: '#dc3545', background: '#fff5f5', padding: '8px', borderRadius: '6px', border: '1px solid #ffe3e3', marginBottom: '15px' }}>
                ⚠️ Google SDK blocked by network or adblocker.
              </div>
              
              {/* 👇 Bypass login button allows instant offline manual testing */}
              <button 
                onClick={handleDeveloperBypass}
                style={{ width: '100%', padding: '10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
              >
                ⚙️ Bypass Auth (Local Sandbox Mode)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '6px 12px', borderRadius: '25px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', fontSize: '12px', fontFamily: 'sans-serif', color: '#333' }}>
        <img src={userProfile.picture} alt="Avatar" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
        <span>Hi, <strong>{userProfile.name}</strong></span>
        <button 
          onClick={handleLogoutTrigger}
          style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', marginLeft: '5px' }}
        >
          Logout
        </button>
      </div>
      <WorkflowCanvas />
    </ReactFlowProvider>
  );
}
