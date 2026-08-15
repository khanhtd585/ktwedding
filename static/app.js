const state = { project: null, album: null, photos: [], nextOffset: 0, hasMore: false, loading: false, current: 0, observer: null, thumbnailQueue: [], activeThumbnails: 0, originalCache: new Map() };
const $ = selector => document.querySelector(selector);
const thumbnailSrc = url => url?.replace(/=s\d+(?:-[A-Za-z0-9-]+)?$/, '=s600') || url;
const api = (url, options = {}) => fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options }).then(async response => {
  if (!response.ok) throw new Error(await response.text());
  return response.headers.get('content-type')?.includes('json') ? response.json() : response;
});
function toast(message) { const item = $('#toast'); item.textContent = message; item.classList.add('show'); setTimeout(() => item.classList.remove('show'), 2500); }

async function boot() { const projects = await api('/api/projects'); if (projects.length) await loadProject(projects[0].id); }
async function loadProject(projectId) { state.project = await api(`/api/projects/${projectId}`); state.album = state.project.albums[0]; render(); await loadPhotos(state.album.id); }
async function loadPhotos(albumId) { state.album = state.project.albums.find(album => album.id === albumId) || state.album; state.photos = []; state.nextOffset = 0; state.hasMore = false; state.loading = false; renderSide(); await loadMorePhotos(); }
async function loadMorePhotos() {
  if (state.loading || !state.album || (state.nextOffset > 0 && !state.hasMore)) return;
  state.loading = true;
  try { const page = await api(`/api/albums/${state.album.id}/photos?offset=${state.nextOffset}&limit=10`); state.photos.push(...page.photos); state.nextOffset += page.photos.length; state.hasMore = page.has_more; state.album.photo_count = page.total; renderGallery(); }
  finally { state.loading = false; }
}
function render() {
  const project = state.project;
  $('#app').innerHTML = `<div class="app"><aside class="side"><button class="brand brand-button" id="projectsHome" aria-label="Back to projects"><i>e</i>everafter</button><p class="project-label">PROJECT</p><div class="project-name">${project.name}</div><div class="album-title">ALBUMS <button id="newAlbum">+</button></div><nav id="albums"></nav><div class="side-footer"><button class="invite" id="invite">+ Invite someone</button><div class="people">${project.members.map(member => `<span class="avatar">${member.avatar_initials}</span>`).join('')}<small>${project.members.length} people in this project</small></div></div></aside><main class="main"><header class="top"><div class="crumb"><button class="crumb-project" id="projectsBreadcrumb">${project.name}</button><b>/ ${state.album.name}</b></div><button class="export" id="export">Export Excel ↗</button></header><section class="page"><div class="heading"><div><p class="kicker">${state.album.is_source ? 'SOURCE ALBUM' : 'FILTER ROUND'}</p><h1>${state.album.name}</h1><p class="sub">Choose the photos that still make your heart skip a beat.</p></div><div class="count"><b id="count">${state.album.liked_count || 0}</b><span>liked / ${state.album.photo_count || 0} photos</span></div></div><div class="tools"><span class="hint">Use ← → to browse &nbsp;·&nbsp; double-click to like</span><button class="new" id="likeAll">Like all</button><button class="new" id="newAlbum2">Create filtered album +</button>${!state.album.is_source && state.project.role === 'owner' ? '<button class="delete-album" id="deleteAlbum">Delete album</button>' : ''}</div><div class="grid" id="grid"></div><div class="lazy-sentinel" id="lazySentinel"></div></section></main></div><div class="modal" id="modal"><header class="viewerbar"><button class="close" id="close">×</button><span id="viewName"></span><span class="viewer-index" id="viewIndex" aria-live="polite"></span><div class="viewer-actions"><button class="notes-button" id="notesToggle">Notes</button><button class="heart" id="heart">♡</button></div></header><button class="nav prev" id="prev">‹</button><div class="viewer"><img id="viewImage" alt="Selected wedding photo"></div><aside class="notes"><div class="notes-head"><p class="kicker">PHOTO NOTES</p><h2 id="noteName"></h2></div><div class="note-list" id="noteList"></div><form class="note-form" id="noteForm"><input id="noteInput" placeholder="Add a note for this photo…"><button>Send</button></form></aside><button class="nav next" id="next">›</button></div><div class="dialog" id="dialog" hidden><div class="dialog-box"><h2>Create a filtered album</h2><p>This album will start with only the liked photos from <b>${state.album.name}</b>.</p><input id="albumName" placeholder="e.g. Final 40"><div class="dialog-actions"><button class="cancel" id="cancel">Cancel</button><button class="create" id="create">Create album</button></div></div></div><div class="toast" id="toast"></div>`;
  renderSide(); bind();
}
function renderSide() { $('#albums').innerHTML = state.project.albums.map(album => `<button class="album ${album.id === state.album.id ? 'active' : ''} ${album.is_source ? 'source' : ''}" data-id="${album.id}"><span>${album.is_source ? '▦' : '♡'}</span><span>${album.name}</span><em>${album.photo_count || 0}</em></button>`).join(''); }
function renderGallery() {
  $('#grid').innerHTML = state.photos.map((photo, index) => `<article class="card thumbnail-loading ${photo.liked ? 'liked' : ''}" data-i="${index}"><img data-src="${thumbnailSrc(photo.thumbnail_url)}" alt="${photo.file_name}"><button class="like" aria-label="Like">${photo.liked ? '♥' : '♡'}</button><span class="filename">${photo.file_name}</span></article>`).join('');
  $('#count').textContent = state.album.liked_count || 0;
  const sentinel = $('#lazySentinel'); sentinel.textContent = state.hasMore ? 'Loading more photos…' : state.photos.length ? 'All photos loaded' : 'No photos in this album';
  state.observer?.disconnect();
  if (state.hasMore) { state.observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMorePhotos(); }, { rootMargin: '350px' }); state.observer.observe(sentinel); }
  queueThumbnails();
}
function queueThumbnails() {
  document.querySelectorAll('#grid img[data-src]:not([data-queued])').forEach(image => { image.dataset.queued = 'true'; state.thumbnailQueue.push(image); });
  loadQueuedThumbnails();
}
function loadQueuedThumbnails() {
  while (state.activeThumbnails < 3 && state.thumbnailQueue.length) {
    const image = state.thumbnailQueue.shift();
    if (!image.isConnected) continue;
    state.activeThumbnails += 1;
    const finish = () => { image.closest('.card')?.classList.remove('thumbnail-loading'); state.activeThumbnails -= 1; loadQueuedThumbnails(); };
    image.onload = finish;
    image.onerror = () => { image.closest('.card')?.classList.add('thumbnail-error'); finish(); };
    image.src = image.dataset.src;
  }
}
function bind() {
  const backToProjects = () => { state.observer?.disconnect(); $('#app').innerHTML = ''; initialise(); };
  $('#projectsHome').onclick = backToProjects;
  $('#projectsBreadcrumb').onclick = backToProjects;
  $('#albums').onclick = event => { const album = event.target.closest('.album'); if (album) loadPhotos(album.dataset.id); };
  $('#grid').onclick = event => { const card = event.target.closest('.card'); if (!card) return; const index = +card.dataset.i; event.target.closest('.like') ? toggle(index) : openPhoto(index); };
  $('#grid').ondblclick = event => { const card = event.target.closest('.card'); if (card) toggle(+card.dataset.i); };
  $('#newAlbum').onclick = $('#newAlbum2').onclick = () => $('#dialog').hidden = false;
  $('#cancel').onclick = () => $('#dialog').hidden = true;
  $('#likeAll').onclick = likeAll;
  $('#deleteAlbum')?.addEventListener('click', deleteAlbum);
  $('#export').onclick = () => window.location = `/api/projects/${state.project.id}/albums/${state.album.id}/export`;
  $('#invite').onclick = () => toast('Invite links are the next Google OAuth integration step.');
  $('#close').onclick = () => $('#modal').classList.remove('open'); $('#notesToggle').onclick = () => $('#modal').classList.toggle('notes-open'); $('#heart').onclick = () => toggle(state.current);
  $('#prev').onclick = () => openPhoto((state.current + state.photos.length - 1) % state.photos.length); $('#next').onclick = () => openPhoto((state.current + 1) % state.photos.length); $('#noteForm').onsubmit = addNote;
  let touchStart;
  $('.viewer').addEventListener('touchstart', event => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  $('.viewer').addEventListener('touchend', event => {
    if (!touchStart || !$('#modal').classList.contains('open')) return;
    const touch = event.changedTouches[0];
    const distanceX = touch.clientX - touchStart.x;
    const distanceY = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(distanceX) < 48 || Math.abs(distanceX) <= Math.abs(distanceY)) return;
    (distanceX < 0 ? $('#next') : $('#prev')).click();
  }, { passive: true });
  document.onkeydown = event => { if (!$('#modal').classList.contains('open')) return; if (event.key === 'ArrowLeft') $('#prev').click(); if (event.key === 'ArrowRight') $('#next').click(); if (event.key === 'Escape') $('#close').click(); };
}
async function toggle(index) { const photo = state.photos[index]; const result = await api(`/api/albums/${state.album.id}/photos/${photo.id}/toggle`, { method: 'POST' }); state.album.liked_count += result.liked ? 1 : -1; photo.liked = result.liked; renderGallery(); if ($('#modal').classList.contains('open')) openPhoto(index); }
async function likeAll() { if (!state.album.photo_count || state.album.liked_count === state.album.photo_count) return toast('Every photo in this album is already liked.'); const result = await api(`/api/albums/${state.album.id}/like-all`, { method: 'POST' }); state.album.liked_count = result.liked_count; state.photos.forEach(photo => photo.liked = true); renderGallery(); toast('All photos in this album are liked.'); }
async function deleteAlbum() { if (!confirm(`Delete “${state.album.name}”? The original photos and notes will remain.`)) return; const parentId = state.album.parent_album_id || state.project.albums.find(album => album.is_source).id; await api(`/api/albums/${state.album.id}`, { method: 'DELETE' }); await loadProject(state.project.id); await loadPhotos(parentId); toast('Album deleted.'); }
function originalImage(photo) {
  if (state.originalCache.has(photo.id)) return state.originalCache.get(photo.id);
  const image = new Image(); image.src = `/api/photos/${photo.id}/image`;
  state.originalCache.set(photo.id, image);
  return image;
}
async function preloadNextPhoto(index) {
  if (!state.photos[index + 1] && state.hasMore) await loadMorePhotos();
  const next = state.photos[index + 1];
  if (next) originalImage(next);
}
function openPhoto(index) {
  state.current = index; const photo = state.photos[index]; const viewer = $('#viewImage');
  viewer.src = thumbnailSrc(photo.thumbnail_url); viewer.classList.add('full-image-loading');
  const original = originalImage(photo);
  const showOriginal = () => { if (state.current === index) { viewer.src = original.src; viewer.classList.remove('full-image-loading'); } };
  if (original.complete) showOriginal(); else { original.onload = showOriginal; original.onerror = () => viewer.classList.remove('full-image-loading'); }
  $('#viewName').textContent = photo.file_name; $('#viewIndex').textContent = `${index + 1} / ${state.album.photo_count || state.photos.length}`; $('#noteName').textContent = photo.file_name; $('#heart').textContent = photo.liked ? '♥' : '♡'; $('#modal').classList.add('open'); loadNotes(photo.id); preloadNextPhoto(index);
}
async function loadNotes(photoId) { const notes = await api(`/api/photos/${photoId}/notes`); $('#noteList').innerHTML = notes.map(note => `<div class="note"><span class="avatar">${note.avatar_initials}</span><div><b>${note.display_name}</b><p>${note.content}</p><small>Added just now</small></div></div>`).join('') || '<p class="sub">No notes yet.</p>'; }
async function addNote(event) { event.preventDefault(); const text = $('#noteInput').value.trim(); if (!text) return; await api(`/api/photos/${state.photos[state.current].id}/notes`, { method: 'POST', body: JSON.stringify({ content: text }) }); $('#noteInput').value = ''; loadNotes(state.photos[state.current].id); }
async function createAlbum() { const name = $('#albumName').value.trim(); if (!name) return; const created = await api(`/api/projects/${state.project.id}/albums`, { method: 'POST', body: JSON.stringify({ name, parent_album_id: state.album.id }) }); $('#dialog').hidden = true; await loadProject(state.project.id); await loadPhotos(created.id); toast('Your filtered album is ready.'); }
// The project dashboard in onboarding.js calls loadProject only after a user chooses a project.
