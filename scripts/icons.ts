import { readFileSync } from "node:fs";

import { chromium } from "playwright-core";

// 16〜48px はツールバーや拡張機能の管理画面に並ぶので、他の拡張と大きさを揃えるため余白を付けない。
// 128px はウェブストアの指針（96px の絵に 16px の透明な余白）に合わせる。
const SIZES = [
  { size: 16, padding: 0 },
  { size: 32, padding: 0 },
  { size: 48, padding: 0 },
  { size: 96, padding: 12 },
  { size: 128, padding: 16 },
];

const executablePath = process.env["CHROMIUM_PATH"];
if (executablePath == null || executablePath === "")
  throw new Error("CHROMIUM_PATH を指定してください");

const svg = `data:image/svg+xml;base64,${readFileSync("src/assets/icon.svg").toString("base64")}`;
const browser = await chromium.launch({ executablePath });
try {
  for (const { size, padding } of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<body style="margin:0;padding:${padding}px"><img src="${svg}" width="${size - padding * 2}" style="display:block"></body>`,
    );
    await page.screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
