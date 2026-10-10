import { pathToFileURL } from "node:url";

import { chromium } from "playwright-core";

const executablePath = process.env["CHROMIUM_PATH"];
if (executablePath == null || executablePath === "")
  throw new Error("CHROMIUM_PATH を指定してください");

const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 640 },
    deviceScaleFactor: 2,
  });
  await page.goto(pathToFileURL("docs/hero/index.html").href);
  await page.screenshot({ path: "docs/hero.png" });
} finally {
  await browser.close();
}
