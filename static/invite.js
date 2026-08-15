function showInviteDialog(url) {
  document.querySelector('#inviteDialog')?.remove();
  const dialog = document.createElement('div'); dialog.id = 'inviteDialog'; dialog.className = 'invite-dialog';
  dialog.innerHTML = `<section class="invite-card"><button class="invite-close" aria-label="Close">×</button><p class="kicker">COLLABORATE</p><h2>Invite someone to choose photos</h2><p>Anyone with this link can sign in with Google and collaborate on this project.</p><input id="inviteLink" value="${url}" readonly><button class="copy-invite" id="copyInvite">Copy invite link</button></section>`;
  document.body.appendChild(dialog); dialog.querySelector('.invite-close').onclick = () => dialog.remove();
  dialog.querySelector('#copyInvite').onclick = async () => { await navigator.clipboard.writeText(url); dialog.querySelector('#copyInvite').textContent = 'Copied!'; };
}
document.querySelector('#app').addEventListener('click', async event => {
  if (!event.target.closest('#invite')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (typeof state === 'undefined' || !state.project) return;
  const response = await fetch(`/api/projects/${state.project.id}/invites`, {method:'POST'});
  if (!response.ok) return alert('Only the project owner can create an invite link.');
  showInviteDialog((await response.json()).url);
}, true);
