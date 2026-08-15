function ensureGeneralNotesButton() {
  const top = document.querySelector('#app .top');
  const exportButton = document.querySelector('#export');
  if (top && exportButton && !document.querySelector('#generalNotes')) {
    const button = document.createElement('button');
    button.id = 'generalNotes'; button.className = 'general-notes-button'; button.type = 'button'; button.textContent = 'General notes';
    top.insertBefore(button, exportButton);
  }
}
function showGeneralNotes() {
  if (typeof state === 'undefined' || !state.project) return;
  document.querySelector('#generalNoteDialog')?.remove();
  const dialog = document.createElement('div'); dialog.id = 'generalNoteDialog'; dialog.className = 'general-note-dialog';
  dialog.innerHTML = `<section class="general-note-card"><button class="general-note-close" aria-label="Close">×</button><p class="kicker">PROJECT NOTE</p><h2>General editing notes</h2><p>These instructions apply to the entire exported album.</p><textarea id="generalNoteText" placeholder="e.g. Keep the edits warm and natural…"></textarea><div class="general-note-actions"><button class="cancel-general">Cancel</button><button class="save-general">Save notes</button></div></section>`;
  document.body.appendChild(dialog);
  const text = dialog.querySelector('#generalNoteText'); text.value = state.project.general_note || ''; text.focus();
  const close = () => dialog.remove();
  dialog.querySelector('.general-note-close').onclick = close; dialog.querySelector('.cancel-general').onclick = close;
  dialog.querySelector('.save-general').onclick = async () => {
    const response = await fetch(`/api/projects/${state.project.id}/general-note`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({content:text.value}) });
    if (!response.ok) return alert('Could not save general notes.');
    state.project.general_note = text.value; close(); toast('General notes saved.');
  };
}
document.querySelector('#app').addEventListener('click', event => { if (event.target.closest('#generalNotes')) showGeneralNotes(); }, true);
new MutationObserver(ensureGeneralNotesButton).observe(document.querySelector('#app'), {childList:true, subtree:true});
ensureGeneralNotesButton();
