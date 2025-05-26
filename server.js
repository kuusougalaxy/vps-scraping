/*─────────────────────────────────────────────────────────────*
  VPS Scraping Server   (ES Modules)           2025-05-21 rev.9
 *─────────────────────────────────────────────────────────────*/

import express              from 'express';
import cors                 from 'cors';
import * as cheerio         from 'cheerio';           // CJS/ESM 両対応
import { DOMParser }        from 'xmldom';
import xpath                from 'xpath';
import puppeteer            from 'puppeteer-extra';
import StealthPlugin        from 'puppeteer-extra-plugin-stealth';
import pkgPQueue            from 'p-queue';

const PQueue = pkgPQueue.default || pkgPQueue;        // v6 (CommonJS) と v9+ (ESM) どちらでも OK
const queue  = new PQueue({ concurrency: 3 });        // 同時実行 3 件（必要に応じて変更）

/* ───── Puppeteer 初期化 ─────────────────────────────── */
puppeteer.use(StealthPlugin());                       // Bot 検知を回避

const defaultLaunchOpts = {
  headless : false,                                   // ← headful (=Chrome UI有り)
  args     : [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
  ],
  env      : { ...process.env },                      // DISPLAY=:99 などをそのまま渡す
};

/* ───── サーバー設定 ─────────────────────────────────── */
const app  = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

/* ───── ユーティリティ ───────────────────────────────── */
const delay = ms => new Promise(r => setTimeout(r, ms));

async function scrapePage (opt) {
  const {
    url, xpaths = [], proxy = false, proxyKey = '',
    headful = false, debug = false,
  } = opt;

  const launchOpts = { ...defaultLaunchOpts, headless: !headful };

  /* 透過プロキシ指定 (データセンター IP など) */
  if (proxy && proxyKey) {
    launchOpts.args.push(`--proxy-server=http://${proxyKey}`);
  }

  const browser = await puppeteer.launch(launchOpts);
  const page    = await browser.newPage();

  /* -- UA と追加ヘッダーをリアル Chrome 相当に調整 */
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  });

  /* ナビゲート */
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120_000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await delay(3500);                                  // JS 完全実行待ち

  /* 必要なら HTML ダンプ */
  let dumpPath = null;
  if (debug) {
    const html = await page.content();
    dumpPath   = `/tmp/scrape-${Date.now()}.html`;
    await import('fs/promises').then(fs => fs.writeFile(dumpPath, html));
  }

  /* XPath or CSS で抽出 */
  const html      = await page.content();
  const dom       = new DOMParser().parseFromString(html, 'text/html');
  const resolver  = xpath.useNamespaces({ xhtml: 'http://www.w3.org/1999/xhtml' });

  const results = {};
  for (const xp of xpaths) {
    try {
      const node  = resolver(xp, dom, true);
      results[xp] = node ? node.toString() : null;
    } catch {
      results[xp] = null;
    }
  }

  if (debug) results.__html_dump = dumpPath;

  await browser.close();
  return results;
}

/* ───── ルーティング ───────────────────────────────── */
app.get('/health', (_, res) => res.send('OK'));

app.post('/scrape', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload?.url) {
      return res.status(400).json({ success:false, error:'url is required' });
    }

    /* キューで順番待ちして実行 */
    const data = await queue.add(() => scrapePage(payload));
    res.json({ success:true, data });
  } catch (err) {
    console.error('[ERROR /scrape]', err);
    res.status(500).json({ success:false, error:String(err) });
  }
});

/* ───── サーバー起動 ───────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Scraping server started on http://0.0.0.0:${PORT} ` +
    `(concurrency=${queue.concurrency}, headful default = ${!defaultLaunchOpts.headless})`
  );
});
