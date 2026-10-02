const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: 'tests',
  timeout: 90000,
  workers: 1,
  use: { baseURL: 'http://localhost:8000', headless: true },
  webServer: { command: 'node build/serve.js', url: 'http://localhost:8000/mock/mock-oracle.html', reuseExistingServer: true },
});
