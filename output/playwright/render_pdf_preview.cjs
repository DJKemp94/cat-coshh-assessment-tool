const { chromium } = require('playwright');
const fs = require('node:fs');

const pdfPath = '/Users/davidkemp/Desktop/CAT/output/playwright/run-confirmed-CAT-CAT-PW-001-20260530.pdf';
const outPath = '/Users/davidkemp/Desktop/CAT/output/playwright/redesigned-report-preview.png';
const pdf = fs.readFileSync(pdfPath).toString('base64');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('console', (msg) => console.log('browser:', msg.type(), msg.text()));
  page.on('pageerror', (error) => console.error('pageerror:', error));
  await page.goto('http://127.0.0.1:5174/');
  await page.setContent(`<!doctype html>
    <html>
      <body style="margin:0;background:#f3f4f6">
        <div id="out" style="display:grid;gap:24px;padding:24px"></div>
        <script type="module">
          import * as pdfjs from 'http://127.0.0.1:5174/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
          pdfjs.GlobalWorkerOptions.workerSrc = 'http://127.0.0.1:5174/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs';
          console.log('pdfjs loaded');
          const raw = atob('${pdf}');
          const data = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i += 1) data[i] = raw.charCodeAt(i);
          const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
          console.log('pages', doc.numPages);
          for (let n = 1; n <= Math.min(doc.numPages, 6); n += 1) {
            const pdfPage = await doc.getPage(n);
            const viewport = pdfPage.getViewport({ scale: 1.45 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.boxShadow = '0 4px 18px #0002';
            canvas.style.background = 'white';
            document.getElementById('out').appendChild(canvas);
            await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          }
          window.done = true;
        </script>
      </body>
    </html>`);
  await page.waitForFunction('window.done === true', null, { timeout: 10000 });
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ outPath }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
