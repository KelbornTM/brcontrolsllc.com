// Project workspaces share the drawing-element layout without changing saved data.
function openProject(project) {
  settingsButton.click();
  settingsNav.hidden = true;
  panels.hidden = true;
  shell.classList.remove('settings-open');
  settingsButton.removeAttribute('aria-current');
  settingsButton.setAttribute('aria-expanded', 'false');
  currentProject = project;
  pinProject(project);
  elementPage.hidden = false;
  document.getElementById('pageTitle').textContent = project.name;
  document.getElementById('pageDescription').textContent = 'Project workspace';
  elementPage.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = project.name;
  const description = document.createElement('p');
  description.textContent = 'Select a drawing element to open its workspace.';
  elementPage.append(heading, description);
  project.elements.forEach(type => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = type;
    button.addEventListener('click', () => openElement(type, project));
    elementPage.appendChild(button);
  });
  const params = new URLSearchParams({ view: 'Project', project: project.id || '' });
  history.replaceState(null, '', location.pathname + location.search + '#' + params);
}
projectSubnav.addEventListener('click', event => {
  const name = event.target.closest('.project-nav-name');
  if (!name) return;
  event.stopImmediatePropagation();
  const names = [...projectSubnav.querySelectorAll('.project-nav-name')];
  const project = openProjects[names.indexOf(name)];
  if (project) openProject(project);
}, true);
const openElementWorkspace = openElement;
openElement = function(type, project) {
  openElementWorkspace(type, project);
  const title = project ? project.name + ' / ' + type : type;
  document.getElementById('pageTitle').textContent = title;
  elementPage.querySelector('h2').textContent = title;
};
