// Series contacts represent the completion of the project's selected elements.
const progressStyle = document.createElement('style');
progressStyle.textContent = `
.library > .table-wrap{overflow:visible}.library table{min-width:0;table-layout:fixed}
#projectCount{margin-left:auto;color:var(--muted);font:11px monospace}
.library-head .primary{margin-left:0}.project-rung{--ladder-line:#7582d2;display:grid;grid-template-columns:minmax(130px,210px) minmax(0,1fr) 180px auto;align-items:center;gap:0}
.project-rung .folder-button{overflow-wrap:anywhere}
.rung-middle{min-width:0;overflow-x:auto;padding:13px 0 9px;scrollbar-width:thin;scrollbar-color:#536181 #0a1421}
.rung-contacts{display:flex;align-items:flex-start;min-width:100%;width:max-content;border-left:2px solid var(--ladder-line);padding-top:3px}
.rung-wire{height:1px;background:var(--ladder-line);min-width:24px;flex:1;align-self:flex-start;margin-top:15px}
.rung-contact{position:relative;flex:none;border:0;background:transparent;color:#ff656d;padding:0 5px;white-space:nowrap;font:12px monospace;display:grid;justify-items:center;gap:4px}
.contact-symbol{position:relative;display:block;width:52px;height:31px;color:inherit;background:linear-gradient(var(--ladder-line),var(--ladder-line)) center/100% 1px no-repeat}
.contact-symbol:before,.contact-symbol:after{content:'';position:absolute;top:5px;width:2px;height:21px;background:currentColor;box-shadow:0 0 4px currentColor}
.contact-symbol:before{left:19px}.contact-symbol:after{right:19px}.contact-tag{display:block;color:currentColor;line-height:1.15;text-align:center}
.rung-contact.done{color:#35e779}.rung-contact.done .contact-symbol{background:linear-gradient(#35e779,#35e779) center/100% 2px no-repeat}
.rung-coil{position:relative;display:grid;justify-items:center;align-content:start;color:#ff656d;font:12px monospace;padding:12px 7px 8px;gap:4px;border-left:1px solid var(--ladder-line)}
.coil-symbol{position:relative;display:block;width:62px;height:32px;background:linear-gradient(var(--ladder-line),var(--ladder-line)) center/100% 1px no-repeat}
.coil-symbol:before{content:'(     )';position:absolute;inset:-6px 0 0;display:grid;place-items:center;color:currentColor;font:30px/32px monospace;letter-spacing:-5px;text-shadow:0 0 4px currentColor}
.coil-tag{max-width:165px;color:currentColor;line-height:1.15;text-align:center}.rung-coil.ready{color:#35e779;font-weight:700}.rung-coil.ready .coil-symbol{background:linear-gradient(#35e779,#35e779) center/100% 2px no-repeat}
.rung-empty{color:var(--muted);white-space:nowrap;padding:7px}
.element-status{display:inline-flex;align-items:center;gap:10px;color:#ff7373;background:#341719;border:1px solid currentColor;border-radius:4px;padding:10px 14px;font:700 12px monospace}.element-status:before{content:'';width:10px;height:10px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}.element-status.ready{color:#55dd91;background:#103322}.heading>div{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
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
      const symbol = document.createElement('span'); symbol.className = 'contact-symbol'; symbol.setAttribute('aria-hidden', 'true');
      const tag = document.createElement('span'); tag.className = 'contact-tag'; tag.textContent = type;
      contact.append(symbol, tag);
      contact.setAttribute('aria-label', type + ': ' + (done ? 'Done' : 'Not done'));
      contact.addEventListener('click', () => openElement(type, project));
      contacts.appendChild(contact); wire();
    });
    middle.appendChild(contacts);
    const ready = project.elements.length > 0 && project.elements.every(type => project.completed?.[type] === true);
    const coil = document.createElement('div');
    coil.className = 'rung-coil' + (ready ? ' ready' : '');
    const coilSymbol = document.createElement('span'); coilSymbol.className = 'coil-symbol'; coilSymbol.setAttribute('aria-hidden', 'true');
    const coilTag = document.createElement('span'); coilTag.className = 'coil-tag'; coilTag.textContent = 'Ready for Generation';
    coil.append(coilSymbol, coilTag);
    coil.setAttribute('role', 'status');
    coil.setAttribute('aria-label', ready ? 'Ready for Generation' : 'Not ready for generation');
    line.insertBefore(middle, menu); line.insertBefore(coil, menu);
  });
};
const standaloneCompletion = new Map();
const elementStatus = document.createElement('button');
elementStatus.type = 'button'; elementStatus.className = 'element-status'; elementStatus.hidden = true;
document.querySelector('.heading > div').appendChild(elementStatus);
primaryNavigation.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { elementStatus.hidden = true; }));
const openProjectWithoutStatus = openProject;
openProject = function(project) { elementStatus.hidden = true; openProjectWithoutStatus(project); };
const openElementWithTitle = openElement;
openElement = function(type, project) {
  openElementWithTitle(type, project);
  elementStatus.hidden = false;
  function updateStatus() {
    const ready = project ? project.completed?.[type] === true : standaloneCompletion.get(type) === true;
    elementStatus.classList.toggle('ready', ready);
    elementStatus.textContent = ready ? 'Ready for Generation' : 'In Development';
    elementStatus.setAttribute('aria-pressed', String(ready));
  }
  elementStatus.onclick = () => {
    if (project) {
      if (!project.completed) project.completed = {};
      project.completed[type] = project.completed[type] !== true;
      markProjectDirty(); renderProjects();
    } else standaloneCompletion.set(type, standaloneCompletion.get(type) !== true);
    updateStatus();
  };
  updateStatus();
};
renderProjects();
