#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = join(repoRoot, "artifacts", "landing-ledger-freeze-qa", timestamp);
const targetUrl = process.env.ORBIT_LEDGER_LOCAL_URL ?? "http://localhost:3001/";

const viewports = [
  { name: "mobile", width: 390, height: 1200, expectsMenu: true, expectsRevampSingleColumn: true },
  { name: "tablet", width: 834, height: 1200, expectsMenu: true, expectsRevampSingleColumn: true },
  { name: "desktop", width: 1440, height: 1200, expectsMenu: false, expectsRevampSingleColumn: false },
];

const sections = [
  ["hero", ".ol-revamp-hero"],
  ["workflow", ".ol-revamp-workflow"],
  ["product", "#product"],
  ["templates", "#templates"],
  ["template-showcase", ".ol-template-stage"],
  ["pricing", "#pricing"],
  ["footer", ".ol-revamp-footer"],
];

function assertSafeUrl(url) {
  if (
    !url.startsWith("http://localhost:") &&
    !url.startsWith("http://127.0.0.1:") &&
    !url.startsWith("https://orbitledger.rudraix.com/") &&
    !url.startsWith("https://orbitledger.bhaumikmehta.com/") &&
    !url.startsWith("https://orbit-ledger-f41c2.web.app/")
  ) {
    throw new Error(`Refusing to run landing freeze QA against unexpected URL: ${url}`);
  }
}

function columnCount(templateColumns) {
  if (!templateColumns || templateColumns === "none") return 0;
  return templateColumns.split(" ").filter(Boolean).length;
}

assertSafeUrl(targetUrl);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];

for (const viewport of viewports) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const fullPagePath = join(outputDir, `${viewport.name}-full-page.png`);
  await page.screenshot({ path: fullPagePath, fullPage: true });

  for (const [name, selector] of sections) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      failures.push(`${viewport.name}: missing landing section ${name} (${selector})`);
      continue;
    }
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
    await page.screenshot({ path: join(outputDir, `${viewport.name}-${name}.png`), fullPage: false });
  }

  const audit = await page.evaluate(() => {
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const viewportWidth = window.innerWidth;
    const textOverflow = [];
    const ignoredDecorativeSelectors = [
      ".ol-ledger-bg-sheet",
      ".ol-landing-hero-ledger",
      ".ol-revamp-workflow",
    ];

    for (const el of document.querySelectorAll("h1,h2,h3,p,a,button,span,strong,b,em,small,li")) {
      if (!visible(el)) continue;
      if (ignoredDecorativeSelectors.some((selector) => el.closest(selector))) continue;
      const rect = el.getBoundingClientRect();
      if (rect.left < -2 || rect.right > viewportWidth + 2) {
        textOverflow.push({
          tag: el.tagName,
          text: (el.textContent || "").trim().slice(0, 120),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    }

    const styleFor = (selector) => {
      const node = document.querySelector(selector);
      return node ? getComputedStyle(node).gridTemplateColumns : null;
    };

    const sectionRects = Array.from(
      document.querySelectorAll(
        ".ol-revamp-hero,.ol-revamp-workflow,.ol-revamp-feature-band,.ol-revamp-template-band,.ol-revamp-beta-cta,.ol-revamp-footer",
      ),
    )
      .map((section) => {
        const rect = section.getBoundingClientRect();
        return { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY };
      })
      .sort((a, b) => a.top - b.top);

    return {
      overflow: document.documentElement.scrollWidth - viewportWidth,
      textOverflow,
      mobileMenuDisplay: getComputedStyle(document.querySelector(".ol-landing-menu-button")).display,
      heroColumns: styleFor(".ol-revamp-hero"),
      featureColumns: styleFor(".ol-revamp-feature-grid"),
      templateGalleryColumns: styleFor(".ol-template-gallery-shell"),
      footerColumns: styleFor(".ol-revamp-footer-main"),
      sectionGaps: sectionRects.slice(0, -1).map((rect, index) => Math.round(sectionRects[index + 1].top - rect.bottom)),
    };
  });

  if (audit.overflow !== 0) {
    failures.push(`${viewport.name}: page has horizontal overflow of ${audit.overflow}px`);
  }
  if (audit.textOverflow.length > 0) {
    failures.push(`${viewport.name}: visible content overflows viewport (${audit.textOverflow.length} nodes)`);
  }
  if (viewport.expectsMenu && audit.mobileMenuDisplay === "none") {
    failures.push(`${viewport.name}: hamburger menu is not visible`);
  }
  if (!viewport.expectsMenu && audit.mobileMenuDisplay !== "none") {
    failures.push(`${viewport.name}: hamburger menu is visible on desktop`);
  }
  if (viewport.expectsRevampSingleColumn) {
    for (const [label, columns] of [
      ["hero", audit.heroColumns],
      ["features", audit.featureColumns],
      ["template gallery", audit.templateGalleryColumns],
      ["footer", audit.footerColumns],
    ]) {
      if (columnCount(columns) !== 1) {
        failures.push(`${viewport.name}: ${label} section is not single-column (${columns})`);
      }
    }
  } else {
    for (const [label, columns] of [
      ["hero", audit.heroColumns],
      ["features", audit.featureColumns],
      ["template gallery", audit.templateGalleryColumns],
      ["footer", audit.footerColumns],
    ]) {
      if (columnCount(columns) <= 1) {
        failures.push(`${viewport.name}: ${label} section did not preserve desktop columns (${columns})`);
      }
    }
  }

  results.push({ viewport, fullPagePath, audit });
  await page.close();
}

await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  targetUrl,
  outputDir,
  results,
  failures,
};

await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(`Landing ledger freeze QA complete: ${outputDir}`);
for (const result of results) {
  console.log(
    `${result.viewport.name}: overflow=${result.audit.overflow}, visibleTextOverflow=${result.audit.textOverflow.length}, menu=${result.audit.mobileMenuDisplay}`,
  );
}

if (failures.length > 0) {
  console.error("Landing ledger freeze QA failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
