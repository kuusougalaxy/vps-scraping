/**
 * scraper.js – 2025‑05‑05 最終版
 * -----------------------------------------------
 *  • headful=false → fetch + cheerio で高速取得
 *  • headful=true  → Puppeteer‑extra + Stealth
 *  • どちらも { success, data|error } を返す
 */

const fetch   = require('node-fetch');
const cheerio = require('cheerio');

/* ── p‑queue (同時 1) ───────────────────────── */
const PQueue = require('p-queue').default || require('p-queue');
exports.queue = new PQueue({ concurrency: 1 });

/* ── Puppeteer を動的 require ───────────────── */
let puppeteer = null;
try {
  puppeteer = require('puppeteer-extra');
  const Stealth = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(Stealth());
} catch (e) {
  console.warn('[scraper] puppeteer‑extra unavailable ‑‑ headful=false only');
}

/* ── Puppeteer 版 ──────────────────────────── */
async function runPuppeteer({ url, xpath }) {
  const browser = await puppeteer.launch({
    headless : false,
    args     : ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });

  /* XPath → outerHTML 取得 */
  const handles = await page.$x(xpath);
  const html    = handles[0]
        ? await page.evaluate(el => el.outerHTML, handles[0])
        : '';

  await browser.close();
  return { success: true, data: { [xpath]: html } };
}

/* ── fetch + cheerio 版 ─────────────────────── */
async function runCheerio({ url, xpath }) {
  const res  = await fetch(url, { timeout: 30_000 });
  const body = await res.text();
  const $    = cheerio.load(body);

  /* cheerio は XPath 未対応 → ひとまず全文返す */
  return { success: true, data: { [xpath]: $.root().html() } };
}

/* ── エクスポート ─────────────────────────── */
exports.scrape = async payload => {
  const { url, xpath = '//body', headful = false, debug = false } = payload;

  try {
    if (headful) {
      if (!puppeteer) throw new Error('headful unavailable on this server');
      return await runPuppeteer({ url, xpath });
    }
    return await runCheerio({ url, xpath });
  } catch (err) {
    if (debug) console.error('[scraper] ERROR:', err.message);
    return { success: false, error: err.message };
  }
};
