// Account-backed project metadata. No localStorage fallback or client-supplied owner.
const saveStatus = document.createElement('div');
saveStatus.className = 'notice'; saveStatus.setAttribute('role', 'status'); saveStatus.id = 'projectSaveStatus';
const saveMessage = document.createElement('span');
const retrySave = document.createElement('button'); retrySave.type = 'button'; retrySave.className = 'secondary'; retrySave.textContent = 'Retry'; retrySave.hidden = true;
saveStatus.append(saveMessage, retrySave); main.insertBefore(saveStatus, document.querySelector('.cards'));
let storageReady = false, storageRevision = 0, changeSequence = 0, saving = false, saveTimer = null, conflict = false;
function storageStatus(message, retry = false) {
  saveMessage.textContent = message;
  retrySave.hidden = !retry;
  // Routine autosave stays quiet; failures remain visible and actionable.
  saveStatus.hidden = !(/^(Save failed:|Could not load projects:|Projects are not loaded\.)/.test(message));
}
function serializedProjects() {
  return projectRecords.map(project => {
    if (!project.id) project.id = crypto.randomUUID();
    return { id: project.id, name: project.name, elements: [...project.elements] };
  });
}
async function apiRequest(method, body) {
  const response = await fetch('/studio/api/projects', {
    method, credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  let data; try { data = await response.json(); } catch { throw new Error('Sign in again or check the project storage configuration.'); }
  if (!response.ok) { const error = new Error(data.error || 'Project save failed.'); error.status = response.status; throw error; }
  return data;
}
function refreshProjectWarning() {
  unsavedNotice.hidden = !(formDirty || projectDataDirty);
  unsavedNotice.textContent = projectDataDirty
    ? 'Project changes are not saved yet. Wait for saving to finish before refreshing or closing this page.'
    : 'Unsaved prototype account/settings entries will be lost if you refresh or close this page.';
}
async function saveProjects() {
  clearTimeout(saveTimer);
  if (!storageReady || saving || conflict || !projectDataDirty) return;
  saving = true; const sequence = changeSequence;
  storageStatus('Saving projects…');
  try {
    const data = await apiRequest('PUT', { revision: storageRevision, projects: serializedProjects() });
    if (!Number.isSafeInteger(data.revision) || data.revision !== storageRevision + 1) throw new Error('Save confirmation was invalid.');
    storageRevision = data.revision;
    projectDataDirty = changeSequence !== sequence;
    refreshProjectWarning();
    storageStatus(projectDataDirty ? 'Saving latest changes…' : 'Saved to your account.');
  } catch (error) {
    conflict = error.status === 409;
    storageStatus('Save failed: ' + error.message + (conflict ? ' Keep this page open if you need to copy your unsaved changes.' : ''), !conflict);
    projectDataDirty = true; refreshProjectWarning();
    saving = false; return;
  }
  saving = false;
  if (projectDataDirty) saveTimer = setTimeout(saveProjects, 100);
}
markProjectDirty = function() {
  projectDataDirty = true; changeSequence++; refreshProjectWarning();
  if (!storageReady) { storageStatus('Projects are not loaded. Changes cannot be saved yet.'); return; }
  storageStatus('Unsaved project changes…'); clearTimeout(saveTimer); saveTimer = setTimeout(saveProjects, 350);
};
async function loadProjects() {
  createProjectButton.disabled = true; storageStatus('Loading your account’s projects…');
  try {
    const data = await apiRequest('GET');
    if (!Array.isArray(data.projects) || !Number.isSafeInteger(data.revision)) throw new Error('Invalid project response.');
    projectRecords.splice(0, projectRecords.length, ...data.projects.map(project => ({ ...project, elements: [...project.elements], expanded: false })));
    openProjects.splice(0); collapsedProjects.clear(); currentProject = null;
    storageRevision = data.revision; storageReady = true; createProjectButton.disabled = false;
    renderProjects(); renderProjectNavigation(); storageStatus('Projects loaded. Changes save automatically to your account.');
  } catch (error) { storageStatus('Could not load projects: ' + error.message, true); }
}
retrySave.addEventListener('click', () => storageReady ? saveProjects() : loadProjects());
panels.addEventListener('input', refreshProjectWarning); panels.addEventListener('change', refreshProjectWarning);
document.querySelector('.bottom span:last-child').textContent = 'Project metadata autosaves; prototype settings do not.';
deleteDialog.querySelectorAll('p')[1].textContent = 'This removes the project or element from your account after the save succeeds. This cannot be undone.';
loadProjects();
