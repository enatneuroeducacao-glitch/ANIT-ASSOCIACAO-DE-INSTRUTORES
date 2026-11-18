import React from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@neondatabase/neon-js';
import { NeonAuthUIProvider, AuthView } from '@neondatabase/auth-ui';
import './auth.css';
import { NEON_AUTH_URL, NEON_DATA_API_URL } from './config.js';

const authUrl = NEON_AUTH_URL;
const dataApiUrl = NEON_DATA_API_URL;
const root = document.getElementById('auth-root');

if (!authUrl || !dataApiUrl) {
  root.textContent = 'Configuração de autenticação indisponível. Contate o administrador do sistema.';
} else {
  const neon = createClient({
    auth: { url: authUrl },
    dataApi: { url: dataApiUrl }
  });
  const params = new URLSearchParams(window.location.search);
  const pathname = params.get('path') || 'sign-in';

  createRoot(root).render(
    <NeonAuthUIProvider authClient={neon.auth} emailOTP>
      <div className="auth-page">
        <div className="auth-brand">
          <div className="auth-mark">ANIT</div>
          <div><strong>Central Administrativa</strong><span>Área restrita da associação</span></div>
        </div>
        <AuthView pathname={pathname} />
        <p className="auth-foot">Acesso exclusivo a usuários previamente autorizados pela administração da ANIT.</p>
        <p className="auth-foot">A recuperação de senha é processada pelo Neon Auth. O e-mail de redefinição é enviado pelo provedor de autenticação Neon, não pelo e-mail institucional da ANIT. Confira também a caixa de spam.</p>
      </div>
    </NeonAuthUIProvider>
  );
}