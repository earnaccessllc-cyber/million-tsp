// Tells Bing and other IndexNow search engines about every URL in the sitemap
// after a production deploy, so new and changed pages are crawled in minutes
// instead of days. https://www.indexnow.org/documentation
//
// Runs only on Netlify production builds (Netlify sets CONTEXT=production), so
// local builds, deploy previews and mobile builds never ping. A failed ping
// must never fail the build, so every error path exits 0.
//
// The key file public/${KEY}.txt proves we own the host; its name and content
// are both the key. Do not rename it without updating KEY here.
import { readFileSync } from "node:fs";

const HOST = "millionfed.com";
const KEY = "db6d3d73f379ab74188c9f8be60b627e";
const ENDPOINT = "https://api.indexnow.org/indexnow";

if (process.env.CONTEXT !== "production" && !process.env.INDEXNOW_FORCE) {
  console.log("indexnow: skipped (not a production build)");
  process.exit(0);
}

try {
  const sitemap = readFileSync("dist/sitemap.xml", "utf8");
  const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (!urlList.length) {
    console.warn("indexnow: no URLs found in dist/sitemap.xml, nothing to submit");
    process.exit(0);
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList,
    }),
  });
  // 200 = accepted, 202 = accepted and key validation pending (normal on the
  // first deploy, before the key file is live).
  console.log(`indexnow: submitted ${urlList.length} URLs, HTTP ${res.status}`);
} catch (err) {
  console.warn(`indexnow: ping failed (${err.message}); build continues`);
}
