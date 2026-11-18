import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@neondatabase/neon-js';
import { NeonAuthUIProvider, AuthView } from '@neondatabase/auth-ui';
import './auth.css';
import { NEON_AUTH_URL, NEON_DATA_API_URL } from './config.js';

const authUrl = NEON_AUTH_URL;
const dataApiUrl = NEON_DATA_API_URL;
const root = document.getElementById('auth-root');

function ResetPasswordOtp({ neon, initialEmail }) {
  const [email, setEmail] = useState(initialEmail || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState('code');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function resendCode() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { error: sendError } = await neon.auth.forgetPassword.emailOtp({ email: email.trim() });
      if (sendError) throw sendError;
      setMessage('Se a conta estiver apta para recuperação, um novo código será enviado pelo Neon Auth. Confira também o spam.');
    } catch (err) {
      setError(err?.message || 'Não foi possível solicitar outro código.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { data, error: verifyError } = await neon.auth.emailOtp.checkVerificationOtp({
        email: email.trim(),
        otp: otp.trim(),
        type: 'forget-password'
      });
      if (verifyError) throw verifyError;
      if (!data?.success) throw new Error('Código inválido ou expirado. Solicite um novo código.');
      setStep('password');
      setMessage('Código confirmado. Agora cadastre sua nova senha.');
    } catch (err) {
      setError(err?.message || 'Não foi possível validar o código.');
    } finally {
      setLoading(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas informadas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await neon.auth.emailOtp.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        password
      });
      if (resetError) throw resetError;
      setStep('done');
      setMessage('Senha alterada com sucesso. Você já pode entrar na Central Administrativa ANIT.');
    } catch (err) {
      setError(err?.message || 'Não foi possível alterar a senha. Solicite um novo código e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="verify-card">
      <h1>Recuperar senha</h1>
      <p>O código de recuperação é enviado pelo Neon Auth. Não é necessário abrir link recebido por e-mail: digite o código nesta página.</p>
      {step !== 'done' && <div className="verify-form">
        <label htmlFor="reset-email">E-mail da conta</label>
        <input id="reset-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={step === 'password'} />
        {step === 'code' ? <form onSubmit={verifyCode}>
          <label htmlFor="reset-otp">Código de recuperação</label>
          <input id="reset-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="000000" />
          <button type="submit" disabled={loading || otp.length !== 6}>{loading ? 'Validando...' : 'Validar código'}</button>
          <button type="button" className="verify-secondary" disabled={loading || !email.trim()} onClick={resendCode}>Enviar outro código</button>
        </form> : <form onSubmit={savePassword}>
          <label htmlFor="new-password">Nova senha</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} />
          <label htmlFor="confirm-password">Confirme a nova senha</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar nova senha'}</button>
        </form>}
      </div>}
      {error && <p className="verify-error" role="alert">{error}</p>}
      {message && <p className="verify-success" role="status">{message}</p>}
      {step === 'done' && <a className="verify-button" href="./admin.html">Ir para o login da Central ANIT</a>}
      <p className="verify-note">Por segurança, o código é temporário e deve ser usado somente nesta página. A recuperação é processada pelo Neon Auth; enquanto o SMTP institucional não estiver configurado, o remetente será o provedor compartilhado do Neon.</p>
    </section>
  );
}

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
  const emailFromUrl = params.get('email') || '';

  createRoot(root).render(
    <NeonAuthUIProvider authClient={neon.auth} emailOTP>
      <div className="auth-page">
        <div className="auth-brand">
          <div className="auth-mark">ANIT</div>
          <div><strong>Central Administrativa</strong><span>Área restrita da associação</span></div>
        </div>
        {pathname === 'verify-email'
          ? <VerifyEmailOtp neon={neon} />
          : pathname === 'reset-password-otp'
            ? <ResetPasswordOtp neon={neon} initialEmail={emailFromUrl} />
            : <AuthView pathname={pathname} />}
        <p className="auth-foot">Acesso exclusivo a usuários previamente autorizados pela administração da ANIT.</p>
        <p className="auth-foot">A verificação e a recuperação de senha são processadas pelo Neon Auth. Enquanto o SMTP institucional não estiver configurado, as mensagens são enviadas pelo provedor compartilhado do Neon. Confira também a caixa de spam.</p>
      </div>
    </NeonAuthUIProvider>
  );
}
