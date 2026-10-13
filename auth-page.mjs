import { createAuthFlow, PASSWORD_HELPER } from './auth-flow.mjs';
const purpose = document.body.dataset.purpose;
const flow = createAuthFlow({href:location.href,purpose});
// Capture once, then scrub BEFORE any Auth request or user interaction.
history.replaceState(null,'',location.pathname);
const heading = document.querySelector('h1'), message = document.querySelector('#message');
const verify = document.querySelector('#verify'), form = document.querySelector('#password-form');
const cancel = document.querySelector('#cancel');
const password = document.querySelector('#password'), confirmation = document.querySelector('#confirmation');
if (document.querySelector('#helper')) document.querySelector('#helper').textContent = PASSWORD_HELPER;
const render = () => {
  const state = flow.state;
  verify.hidden = state.phase !== 'ready'; verify.disabled = state.busy;
  form.hidden = state.phase !== 'password';
  cancel.hidden = ['updated','confirmed','cancelled','invalid'].includes(state.phase);
  if (state.phase === 'password') {
    heading.textContent = 'Choose a new password';
    message.textContent = `Reset for ${state.email}. Return to Incrementum and sign in after saving.`;
    password.focus();
  } else if (state.phase === 'confirmed') {
    heading.textContent = 'Email confirmed';
    message.textContent = 'Your Incrementum account is ready. You can now return to Incrementum and sign in.';
  } else if (state.phase === 'updated') {
    heading.textContent = 'Password updated';
    message.textContent = 'Return to Incrementum and sign in with your new password.';
  } else if (state.phase === 'invalid') message.textContent = 'This link cannot be verified. It may be expired, already used, or an older link that needs the original phone. Request a new email from Incrementum.';
  else if (state.phase === 'cancelled') message.textContent = 'Cancelled. Return to Incrementum to request a new email link.';
};
verify.addEventListener('click',async () => {
  verify.disabled = true; message.textContent = 'Verifying your email link…';
  try { await flow.verify(); render(); } catch { render(); }
});
form.addEventListener('submit',async event => {
  event.preventDefault(); if (flow.state.busy) return;
  const submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
  try { await flow.updatePassword(password.value,confirmation.value); render(); }
  catch (error) { render(); message.textContent = error.message; }
  finally { password.value = ''; confirmation.value = ''; submit.disabled = false; }
});
document.querySelector('#show-password')?.addEventListener('change',event => {
  password.type = event.target.checked ? 'text' : 'password'; confirmation.type = password.type;
});
cancel.addEventListener('click',() => { flow.cancel(); if (password) password.value = ''; if (confirmation) confirmation.value = ''; render(); });
addEventListener('pagehide',() => flow.cancel());
render();
