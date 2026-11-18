import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@neondatabase/neon-js';
import { NeonAuthUIProvider, AuthView } from '@neondatabase/auth-ui';
import './auth.css';
import { NEON_AUTH_URL, NEON_DATA_API_URL } from './config.js';

const authUrl = NEON_AUTH_URL;
const dataApiUrl = NEON_DATA_API_URL;
const root = document.getElementById('auth-root');

function VerifyEmailOtp({ neon }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const { data, error: verifyError } = await neon.auth.emailOtp.verifyEmail({
        email: email.trim(),
        otp: otp.trim()
      });
      if (verifyError) throw verifyError;
      setVerified(true);
      setMessage(data?.session
        ? 'E-mail confirmado. Sua conta está verificada.'
        : 'E-mail confirmado com sucesso. Agora volte ao acesso da Central e use “Esqueci minha senha” para cadastrar sua senha pessoal.');
    } catch (err) {
      setError(err?.message || 'Não foi possível validar o código. Confira o e-mail e o código ou solicite um novo código.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="verify-card">
      <h1>Confirmar e-mail</h1>
      <p>O Neon Auth enviou um código de verificação. Informe o mesmo e-mail que recebeu a mensagem e digite o código de seis dígitos.</p>
      <form onSubmit={handleSubmit} className="verify-form">
        <label htmlFor="verify-email">E-mail da conta</label>
        <input id="verify-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" disabled={verified} />
        <label htmlFor="verify-otp">Código recebido por e-mail</label>
        <input id="verify-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="000000" disabled={verified} />
        {error && <p className="verify-error" role="alert">{error}</p>}
        {message && <p className="verify-success" role="status">{message}</p>}
        {!verified && <button type="submit" disabled={loading || otp.length !== 6}>{loading ? 'Validando...' : 'Confirmar e-mail'}</button>}
        {verified && <a className="verify-button" href="./admin.html">Voltar ao acesso da Central ANIT</a>}
      </form>
      <p className="verify-note">O código é temporário e deve ser usado somente nesta página. A recuperação e a verificação são processadas pelo Neon Auth, não pelo remetente institucional da ANIT.</p>
    </section>
  );
}

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
        {pathname === 'verify-email'
          ? <VerifyEmailOtp neon={neon} />
          : <AuthView pathname={pathname} />}
        <p className="auth-foot">Acesso exclusivo a usuários previamente autorizados pela administração da ANIT.</p>
        <p className="auth-foot">A verificação e a recuperação de senha são processadas pelo Neon Auth. Enquanto o SMTP institucional não estiver configurado, as mensagens são enviadas pelo provedor compartilhado do Neon. Confira também a caixa de spam.</p>
      </div>
    </NeonAuthUIProvider>
  );
}
