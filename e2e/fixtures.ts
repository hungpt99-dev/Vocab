import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';

const here = dirname(fileURLToPath(import.meta.url));
export const EXTENSION_PATH = resolve(here, '..', 'dist');

const SAMPLE_HTML = `<!doctype html><html lang="en"><head><title>Sample Article</title></head>
<body><main>
  <p id="para">Pure serendipity struck me today while reading.</p>
  <p id="second">Another mention of serendipity appears here.</p>
</main></body></html>`;

interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  samplePageUrl: string;
}

/**
 * Content scripts declared with `<all_urls>` are not injected into `data:` or
 * `about:` URLs, so tests serve their fixture page over real HTTP.
 */
export const test = base.extend<ExtensionFixtures>({
  samplePageUrl: async ({}, use) => {
    const server: Server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(SAMPLE_HTML);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const { port } = server.address() as AddressInfo;

    await use(`http://127.0.0.1:${port}/`);
    await new Promise<void>((done) => server.close(() => done()));
  },

  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    const existing = context.serviceWorkers()[0];
    const worker = existing ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;
