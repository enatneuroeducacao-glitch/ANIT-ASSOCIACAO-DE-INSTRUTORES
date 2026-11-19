import { createClient } from '@neondatabase/neon-js';
import { NEON_AUTH_URL, NEON_DATA_API_URL } from './config.js';

const client = createClient({
  auth: { url: NEON_AUTH_URL },
  dataApi: { url: NEON_DATA_API_URL, options: { db: { schema: 'anit' } } }
});
const params = new URLSearchParams(window.location.search);
const inviteToken = params.get('token');
const invitedEmail = (params.get('email') || '').trim().toLowerCase();
const invitedName = params.get('name') || '';
const form = document.getElementById('activateForm');
const nameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const passwordFields = document.getElementById('passwordFields');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirmPassword');
const otpField = document.getElementById('otpField');
const otpInput = document.getElementById('otp');
const button = document.getElementById('activateButton');
const message = document.getElementById('activateMessage');
let awaitingOtp = false;

function show(text, kind='info') {
  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = false;
}
function setStepOtp() {
  awaitingOtp = true;
  passwordFields.hidden = true;
  passwordInput.disabled = true;
  confirmInput.disabled = true;
  otpField.hidden = false;
  otpInput.disabled = false;
  otpInput.required = true;
  button.textContent = 'Confirmar e-mail e ativar acesso';
}
function setBusy(value, label) {
  button.disabled = value;
  if (label) button.textContent = label;
}

nameInput.value = invitedName;
emailInput.value = invitedEmail;
if (!inviteToken || !invitedEmail || !invitedName) {
  form.querySelectorAll('input,button').forEach(el => el.disabled = true);
  show('Este link de convite está incompleto. Solicite à Presidência um novo convite.', 'error');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  message.hidden = true;
  try {
    if (!awaitingOtp) {
      const password = passwordInput.value;
      if (password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
      if (password !== confirmInput.value) throw new Error('As senhas não coincidem.');
      setBusy(true, 'Criando sua conta...');
      const { data, error } = await client.auth.signUp.email({
        email: invitedEmail,
        password,
        name: invitedName
      });
      if (error) throw new Error(error.message || 'Não foi possível criar sua conta.');
      setStepOtp();
      show('Conta criada. Enviamos um código de confirmação para '+invitedEmail+'. Informe o código recebido para liberar seu acesso.', 'success');
      setBusy(false);
      return;
    }

    const otp = otpInput.value.trim();
    if (!otp) throw new Error('Informe o código enviado ao seu e-mail.');
    setBusy(true, 'Validando código...');
    const { error: verifyError } = await client.auth.emailOtp.verifyEmail({ email: invitedEmail, otp });
    if (verifyError) throw new Error(verifyError.message || 'O código não foi aceito.');

    let sessionResult = await client.auth.getSession();
    if (!sessionResult?.data?.session) {
      const password = passwordInput.value;
      const { error: signInError } = await client.auth.signIn.email({ email: invitedEmail, password, rememberMe: true });
      if (signInError) throw new Error('E-mail confirmado. Entre com sua senha na Central para concluir a ativação. Detalhe: '+signInError.message);
      sessionResult = await client.auth.getSession();
    }
    if (!sessionResult?.data?.session) throw new Error('E-mail confirmado, mas a sessão não foi iniciada. Acesse a Central e entre com sua senha para concluir a ativação.');

    const { data: profile, error: claimError } = await client.rpc('claim_user_invitation', { p_invite_token: inviteToken });
    if (claimError) throw new Error(claimError.message || 'Não foi possível vincular seu perfil institucional.');
    show('E-mail confirmado e perfil institucional ativado. Você já pode acessar a Central Administrativa da ANIT.', 'success');
    button.type = 'button';
    button.textContent = 'Ir para a Central Administrativa';
    button.disabled = false;
    button.onclick = () => { window.location.href = './admin.html'; };
    form.onsubmit = null;
    form.addEventListener('submit', e => { e.preventDefault(); window.location.href = './admin.html'; }, { once: true });
  } catch (error) {
    show(error?.message || 'Ocorreu um erro durante a ativação. Solicite ajuda à Presidência.', 'error');
    setBusy(false, awaitingOtp ? 'Confirmar e-mail e ativar acesso' : 'Criar conta e enviar código');
  }
});
