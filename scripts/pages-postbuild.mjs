/**
 * Prepares dist/client for static hosting on GitHub Pages:
 *  - rewrites absolute paths in manifest.webmanifest to the deploy base
 *  - copies index.html to 404.html so deep links keep working
 *  - adds .nojekyll so files/folders starting with "_" are served
 */
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = process.env["PAGES_BASE"] ?? "/";
const dir = "dist/client";

const manifestPath = join(dir, "manifest.webmanifest");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const prefix = (path) => (path.startsWith("/") ? base.replace(/\/$/, "") + path : path);

manifest.start_url = base;
manifest.scope = base;
manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: prefix(icon.src) }));
if (manifest.share_target) manifest.share_target.action = prefix(manifest.share_target.action);
if (manifest.file_handlers) {
  manifest.file_handlers = manifest.file_handlers.map((handler) => ({
    ...handler,
    action: prefix(handler.action),
  }));
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

await copyFile(join(dir, "index.html"), join(dir, "404.html"));
await writeFile(join(dir, ".nojekyll"), "");

console.log(`pages-postbuild: prepared ${dir} for base ${base}`);
