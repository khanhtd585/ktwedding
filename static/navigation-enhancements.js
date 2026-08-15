function decorateAlbumNavigation() {
  const sidebar = document.querySelector('#app .side');
  if (sidebar && !document.querySelector('#sidebarClose')) {
    const close = document.createElement('button');
    close.id = 'sidebarClose'; close.className = 'sidebar-close'; close.type = 'button'; close.textContent = '×';
    close.setAttribute('aria-label', 'Close albums menu'); sidebar.prepend(close);
  }
  const top = document.querySelector('#app .top');
  if (top && !document.querySelector('#sidebarToggle')) {
    const toggle = document.createElement('button');
    toggle.id = 'sidebarToggle'; toggle.className = 'sidebar-toggle'; toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Show or hide albums'); toggle.textContent = '☰';
    top.insertBefore(toggle, top.firstChild);
  }
  document.querySelectorAll('#albums > .album:not(.source)').forEach(album => {
    if (album.parentElement.classList.contains('album-row')) return;
    const row = document.createElement('div'); row.className = 'album-row';
    const remove = document.createElement('button'); remove.className = 'album-delete'; remove.type = 'button'; remove.textContent = '×';
    remove.dataset.albumId = album.dataset.id; remove.setAttribute('aria-label', `Delete ${album.textContent.trim()}`);
    album.parentNode.insertBefore(row, album); row.append(album, remove);
  });
}

document.querySelector('#app').addEventListener('click', async event => {
  const toggle = event.target.closest('#sidebarToggle');
  if (toggle) {
    const side = document.querySelector('#app .side');
    if (window.matchMedia('(max-width: 720px)').matches) side.classList.toggle('open');
    else document.querySelector('#app > .app').classList.toggle('sidebar-hidden');
    return;
  }
  if (event.target.closest('#sidebarClose')) { document.querySelector('#app .side').classList.remove('open'); return; }
  const remove = event.target.closest('.album-delete');
  if (remove) {
    event.preventDefault(); event.stopImmediatePropagation();
    const albumId = remove.dataset.albumId;
    if (typeof state === 'undefined' || typeof loadPhotos !== 'function' || typeof deleteAlbum !== 'function') return;
    if (state.album.id !== albumId) await loadPhotos(albumId);
    await deleteAlbum();
  }
}, true);

new MutationObserver(decorateAlbumNavigation).observe(document.querySelector('#app'), { childList: true, subtree: true });
decorateAlbumNavigation();
