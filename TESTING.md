# Browser testing

Run locally with Node.js 24 and Python 3 installed:

```sh
npm install
npx playwright install chromium
npm test
```

On Linux, use `npx playwright install --with-deps chromium` if browser system dependencies are missing.

Tests cover desktop and mobile project creation, selected project names, renaming, numbering, adding drawing elements, project navigation, company settings, billing, and standalone tools. JavaScript runtime errors fail tests.

The GitHub Actions **Browser tests** workflow runs on pushes to main and drawing-tool-dev, on pull requests, and manually from Actions. Download the browser-test-report artifact to inspect failures and retained traces.

Tests serve a local checkout; they do not use accounts, charge money, or test live Cloudflare Access. They do not block Cloudflare deployment automatically. Required checks and deployment gating must be configured separately.
