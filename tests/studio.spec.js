const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => {
  let saved = { projects: [], revision: 0 };
  await page.route('**/studio/api/projects', async route => {
    if (route.request().method() === 'PUT') {
      const next = route.request().postDataJSON();
      if (next.revision !== saved.revision) return route.fulfill({ status: 409, json: { error: 'Conflict' } });
      saved = { projects: next.projects, revision: saved.revision + 1 };
      return route.fulfill({ json: { revision: saved.revision } });
    }
    return route.fulfill({ json: saved });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.__runtimeErrors = errors;
  await page.goto('/studio/index.html');
});
test('projects survive refresh after successful save', async ({ page }) => {
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await page.getByRole('textbox', { name: 'Project name', exact: true }).press('Enter');
  await expect(page.locator('#projectSaveStatus')).toContainText('Saved to your account.');
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.type()); await dialog.accept(); });
  await page.reload();
  await expect(page.locator('.folder-button')).toContainText('Project 1');
  expect(dialogs).toEqual([]);
});
test('failed saves remain unsaved and warn before leaving', async ({ page }) => {
  await page.route('**/studio/api/projects', async route => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 503, json: { error: 'Database offline' } });
    return route.fulfill({ json: { projects: [], revision: 0 } });
  });
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await page.getByRole('textbox', { name: 'Project name', exact: true }).press('Enter');
  await expect(page.locator('#projectSaveStatus')).toContainText('Save failed');
  const dialogPromise = page.waitForEvent('dialog');
  const navigation = page.reload();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('beforeunload'); await dialog.accept(); await navigation;
});
test.afterEach(async ({ page }) => {
  expect(page.__runtimeErrors).toEqual([]);
});
test('create, rename, number projects, and open a drawing element', async ({ page }) => {
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'Project name', exact: true });
  await expect(name).toHaveValue('Project 1');
  await expect(name).toBeFocused();
  expect(await name.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([0, 9]);
  await name.press('Enter');
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await expect(name).toHaveValue('Project 2');
  await name.fill('Pump Station');
  await name.press('Enter');
  const picker = page.getByRole('combobox', { name: 'Add drawing element to Pump Station' });
  await picker.selectOption('I/O List');
  await picker.selectOption('Title Block');
  await page.locator('.element-list .element-button').filter({ hasText: 'I/O List' }).last().click();
  await expect(page.locator('.project-nav-name')).toHaveText('Pump Station');
  await expect(page.locator('.project-nav-elements button')).toHaveCount(2);
  await page.locator('.project-nav-elements button').filter({ hasText: 'I/O List' }).click();
  await expect(page.locator('#pageTitle')).toHaveText('Pump Station / I/O List');
  await expect(page.locator('#pageDescription')).toHaveText('Project: Pump Station');
  await page.locator('.project-nav-name').click();
  await expect(page.locator('#pageTitle')).toHaveText('Pump Station');
  await expect(page.locator('#pageDescription')).toHaveText('Project workspace');
  await page.locator('.project-nav-elements button').filter({ hasText: 'Title Block' }).click();
  await expect(page.locator('#pageTitle')).toHaveText('Pump Station / Title Block');
});
test('settings submenu and company toggle work', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('#settingsSubmenu')).toBeVisible();
  await page.getByRole('switch').check();
  await expect(page.locator('#companyOptions')).toBeVisible();
  await page.locator('#settingsSubmenu').getByRole('button', { name: 'Billing' }).click();
  await expect(page.locator('[data-panel="Billing"]')).toBeVisible();
  await expect(page.locator('[data-panel="Billing"]')).toContainText('$15 per I/O point');
  await expect(page.locator('[data-panel="Billing"]')).toContainText('all .DWG drawing files');
  await expect(page.locator('[data-panel="Billing"]')).toContainText('cannot reasonably distinguish between a revision and a different project');
  await expect(page.locator('[data-panel="Billing"]')).not.toContainText('Flat revision fee');
});
test('additional tools open without a project', async ({ page }) => {
  await page.getByRole('button', { name: 'Additional Tools +' }).click();
  await page.locator('#additionalTools').getByRole('button', { name: 'BOM', exact: true }).click();
  await expect(page.locator('#pageTitle')).toHaveText('BOM');
  await expect(page.locator('#pageDescription')).toContainText('Standalone tool');
});
