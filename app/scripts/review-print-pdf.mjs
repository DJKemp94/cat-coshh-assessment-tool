// Review chunk 3: import the live draft, open the report preview, print to PDF.
import { chromium } from 'playwright';

const DRAFT = process.env.DRAFT || '/Users/davidkemp/Downloads/LabCAT-untitled-20260610.labcatdraft';
const OUT = process.env.OUT || '/Users/davidkemp/Desktop/CAT/output/review/report-full.pdf';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5173');

// dismiss privacy modal
await page.getByRole('button', { name: /I understand/ }).click();

// import the draft via the hidden file input
const input = page.locator('input[type=file]');
await input.setInputFiles(DRAFT);
await page.waitForTimeout(1500);

// handle any confirm dialog the import may raise
page.on('dialog', (d) => d.accept());

// navigate to Complete & Export and open the report preview
await page.getByRole('button', { name: 'Complete & Export' }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Preview \/ Save PDF/ }).click();
await page.waitForTimeout(1500);

console.log('dialog visible:', await page.locator('[role=dialog]').count());

// click the dialog's own print button (with window.print stubbed) so the app
// applies its report-printing setup, then capture the PDF
await page.evaluate(() => { window.print = () => {}; });
await page.getByRole('button', { name: /^Print \/ Save PDF$/ }).click();
await page.waitForTimeout(800);
console.log('report-printing class:', await page.evaluate(() => document.body.className));

await page.emulateMedia({ media: 'print' });
await page.pdf({ path: OUT, format: 'A4', printBackground: true });
console.log('wrote', OUT);
await browser.close();
