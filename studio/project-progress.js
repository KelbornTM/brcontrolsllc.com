// Series contacts represent the completion of the project's selected elements.
const progressStyle = document.createElement('style');
progressStyle.textContent = `
.library > .table-wrap{overflow:visible}.library table{min-width:0;table-layout:fixed}
#projectCount{margin-left:auto;color:var(--muted);font:11px monospace}
.library-head .primary{margin-left:0}.project-rung{display:grid;grid-template-columns:minmax(130px,210px) minmax(0,1fr) 170px auto;align-items:center;gap:0}
.project-rung .folder-button{overflow-wrap:anywhere}
.rung-middle{min-width:0;overflow-x:auto;padding:16px 0;scrollbar-width:thin}
.rung-contacts{display:flex;align-items:center;min-width:100%;width:max-content}
.rung-wire{height:2px;background:var(--muted);min-width:22px;flex:1}
.rung-contact{position:relative;flex:none;border:0;border-left:3px solid currentColor;border-right:3px solid currentColor;background:#081320;color:#ff7373;padding:8px 12px;white-space:nowrap;font:13px monospace}
.rung-contact.done{color:#55dd91}.rung-coil{display:flex;align-items:center;color:#ff7373;font:13px monospace;padding:12px 6px;gap:8px}
.rung-coil:before,.rung-coil:after{content:'';width:12px;height:38px;border:2px solid currentColor;border-top:0;border-bottom:0;border-radius:50%;flex:none}
.rung-coil.ready{color:#55dd91;font-weight:700}.rung-empty{color:var(--muted);white-space:nowrap;padding:8px}
.element-completion{display:flex;align-items:center;gap:12px;margin-top:24px;padding:16px;border:1px solid var(--line)}
.element-completion input{width:20px;height:20px;accent-color:#55dd91}
@media(max-width:600px){.project-row td{padding:12px 8px}.project-rung{grid-template-columns:minmax(0,1fr) 136px auto}.project-rung>.folder-button{grid-column:1/-1}.rung-coil{font-size:11px;padding:12px 3px}.rung-contact{font-size:12px}}
`;
document.head.appendChild(progressStyle);
const renderLibraryWithMenus = renderProjects;
renderProjects = function(editProject) {
  renderLibraryWithMenus(editProject);
  [...libraryBody.rows].forEach((row, index) => {
    const project = projectRecords[index];
    if (!project) return;
    const line = row.querySelector('.file-line');
    if (!line) return;
    line.classList.add('project-rung');
    const menu = line.querySelector('.file-menu');
    const middle = document.createElement('div');
    middle.className = 'rung-middle';
    middle.tabIndex = 0;
    middle.setAttribute('aria-label', project.name + ' drawing element progress');
    const contacts = document.createElement('div');
    contacts.className = 'rung-contacts';
    function wire() { const span = document.createElement('span'); span.className = 'rung-wire'; span.setAttribute('aria-hidden', 'true'); contacts.appendChild(span); }
    wire();
    if (!project.elements.length) {
      const empty = document.createElement('span'); empty.className = 'rung-empty'; empty.textContent = 'Add drawing elements'; contacts.appendChild(empty);
    }
    project.elements.forEach(type => {
      const done = project.completed?.[type] === true;
      const contact = document.createElement('button');
      contact.type = 'button';
      contact.className = 'rung-contact' + (done ? ' done' : '');
      contact.textContent = type;
      contact.setAttribute('aria-label', type + ': ' + (done ? 'Done' : 'Not done'));
      contact.addEventListener('click', () => openElement(type, project));
      contacts.appendChild(contact); wire();
    });
    middle.appendChild(contacts);
    const ready = project.elements.length > 0 && project.elements.every(type => project.completed?.[type] === true);
    const coil = document.createElement('div');
    coil.className = 'rung-coil' + (ready ? ' ready' : '');
    coil.textContent = 'Ready for Generation';
    coil.setAttribute('role', 'status');
    coil.setAttribute('aria-label', ready ? 'Ready for Generation' : 'Not ready for generation');
    line.insertBefore(middle, menu); line.insertBefore(coil, menu);
  });
};
const openElementWithTitle = openElement;
openElement = function(type, project) {
  openElementWithTitle(type, project);
  if (!project) return;
  const label = document.createElement('label'); label.className = 'element-completion';
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
  checkbox.checked = project.completed?.[type] === true;
  const text = document.createElement('span'); text.textContent = 'Done';
  checkbox.addEventListener('change', () => {
    if (!project.completed) project.completed = {};
    project.completed[type] = checkbox.checked;
    markProjectDirty(); renderProjects();
  });
  label.append(checkbox, text); elementPage.appendChild(label);
};
renderProjects();
