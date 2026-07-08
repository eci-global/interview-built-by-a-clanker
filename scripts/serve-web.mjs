#!/usr/bin/env node
// Dependency-free static file server for the built SPA.
//
// Serves apps/web/dist on 0.0.0.0:5173 using only Node built-ins:
//   - Correct MIME types for common web assets.
//   - SPA index.html fallback for unknown (non-file) paths, so client-side
//     routes like /personas/p-001 return the app shell with HTTP 200.
//   - No Host-header / DNS-rebinding checks (unlike Vite's preview server),
//     so http://localhost:5173/ reliably answers with 200 for health polls.
//   - Clear foreground logging.

import http from "node:http";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "0.0.0.0";
const PORT = 5173;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(REPO_ROOT, "apps", "web", "dist");
const INDEX_FILE = path.join(DIST_DIR, "index.html");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".wasm": "application/wasm",
};

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

// Resolve a request URL path to a file inside DIST_DIR, guarding against
// path traversal. Returns an absolute path within DIST_DIR or null.
function resolveWithinDist(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  } catch {
    return null;
  }
  // Normalize and strip leading slashes so join stays inside DIST_DIR.
  const relative = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const resolved = path.join(DIST_DIR, relative);
  if (resolved !== DIST_DIR && !resolved.startsWith(DIST_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

async function statFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() ? stat : null;
  } catch {
    return null;
  }
}

function sendFile(res, filePath, stat, statusCode = 200) {
  res.writeHead(statusCode, {
    "Content-Type": contentTypeFor(filePath),
    "Content-Length": stat.size,
    "Cache-Control": "no-cache",
  });
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  if (method !== "GET" && method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain", Allow: "GET, HEAD" });
    res.end("Method Not Allowed");
    return;
  }

  let target = resolveWithinDist(req.url || "/");

  // Directory or root request -> index.html of that directory.
  if (target) {
    const stat = await statFile(target);
    if (stat) {
      if (method === "HEAD") {
        res.writeHead(200, { "Content-Type": contentTypeFor(target), "Content-Length": stat.size });
        res.end();
        return;
      }
      sendFile(res, target, stat);
      return;
    }
  }

  // SPA fallback: serve index.html for any non-file path.
  const indexStat = await statFile(INDEX_FILE);
  if (!indexStat) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("index.html not found in apps/web/dist. Did the build run?");
    return;
  }
  if (method === "HEAD") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": indexStat.size });
    res.end();
    return;
  }
  sendFile(res, INDEX_FILE, indexStat, 200);
});

server.on("error", (err) => {
  console.error(`[serve-web] server error: ${err.message}`);
  process.exit(1);
});

// Verify the build output exists up front for a clear error message.
statFile(INDEX_FILE).then((stat) => {
  if (!stat) {
    console.error(`[serve-web] ERROR: ${INDEX_FILE} is missing.`);
    console.error("[serve-web] Run the build first (pnpm build produces apps/web/dist/).");
    process.exit(1);
  }
  server.listen(PORT, HOST, () => {
    console.log(`[serve-web] serving ${DIST_DIR} on http://localhost:${PORT}/`);
    console.log(`[serve-web] bound to ${HOST}:${PORT} (SPA fallback enabled, no host check)`);
  });
});

function shutdown(signal) {
  console.log(`[serve-web] received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
  // Force exit if connections linger.
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
