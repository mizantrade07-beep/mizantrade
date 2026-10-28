#!/usr/bin/env node
/**
 * Deploy the working tree to the live server over SFTP only.
 * Works on cPanel accounts where SSH shell access is disabled:
 * no exec, no tar, no npm — just file mirroring + Passenger restart.
 *
 *   npm run deploy            # sync changed files + restart
 *   npm run deploy -- --dry   # show what would change
 *
 * Credentials: .env.deploy (never committed) or environment (CI).
 * Never uploads .env, node_modules, uploads, storage, .git or logs.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { Client } = require("ssh2");

require("dotenv").config({ path: path.join(__dirname, "..", ".env.deploy") });

const ROOT = path.join(__dirname, "..");
const DRY = process.argv.includes("--dry");

const HOST = process.env.SSH_HOST;
const PORT = Number(process.env.SSH_PORT || 2222);
const USER = process.env.SSH_USER;
const PASS = process.env.SSH_PASS;
const KEY = process.env.SSH_KEY_PATH || (process.env.SSH_KEY ? materialiseKey(process.env.SSH_KEY) : "");
const APP_DIR = (process.env.APP_DIR || "").replace(/\/+$/, "");
const HEALTH_URL = process.env.HEALTH_URL || "https://www.mizantrade.com/health";

const SKIP_DIRS = new Set([".git", "node_modules", "tmp", ".qoder", ".github"]);
const SKIP_PATHS = new Set([
    ".env", ".env.deploy", "server.log",
    "public/uploads", "storage/private"
]);

function materialiseKey(value) {
    const file = path.join(os.tmpdir(), "mizantrade-ci-key");
    fs.writeFileSync(file, value.replace(/\\n/g, "\n"), { mode: 0o600 });
    return file;
}

function log(msg) {
    console.log(msg);
}

function fail(msg) {
    console.error("\nDEPLOY FAILED: " + msg);
    process.exit(1);
}

function requireConfig() {
    const missing = [];
    if (!HOST) missing.push("SSH_HOST");
    if (!USER) missing.push("SSH_USER");
    if (!APP_DIR) missing.push("APP_DIR");
    if (!PASS && !KEY) missing.push("SSH_PASS or SSH_KEY_PATH");
    if (missing.length) fail("missing " + missing.join(", ") + " in D:\\mizantrade\\.env.deploy");
}

/* ---------------- local tree ---------------- */

function walk(dir, base = "", out = []) {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = base ? base + "/" + entry.name : entry.name;
        if (SKIP_PATHS.has(rel)) continue;
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(path.join(dir, entry.name), rel, out);
        } else if (entry.isFile()) {
            if (/.\.log$/i.test(entry.name)) continue;
            out.push(rel);
        }
    }
    return out;
}

/* ---------------- ssh ---------------- */

function connect() {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on("ready", () => resolve(conn));
        conn.on("error", reject);
        conn.connect({
            host: HOST,
            port: PORT,
            username: USER,
            password: PASS || undefined,
            privateKey: KEY ? fs.readFileSync(KEY.replace(/^~/, os.homedir())) : undefined,
            readyTimeout: 30000,
            keepaliveInterval: 15000
        });
    });
}

function sftpSession(conn) {
    return new Promise((resolve, reject) => conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp))));
}

const call = (sftp, method, ...args) =>
    new Promise((resolve, reject) => sftp[method](...args, (err, result) => (err ? reject(err) : resolve(result))));

async function ensureDir(sftp, remoteDir, made = new Set()) {
    if (made.has(remoteDir)) return;
    const parts = remoteDir.split("/");
    let current = "";
    for (const part of parts) {
        if (!part) continue;
        current += "/" + part;
        if (made.has(current)) continue;
        try {
            await call(sftp, "mkdir", current);
        } catch (err) { /* already exists */ }
        made.add(current);
    }
}

async function statOrNull(sftp, remote) {
    try {
        return await call(sftp, "stat", remote);
    } catch (err) {
        return null;
    }
}

async function pool(items, limit, worker) {
    let index = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const item = items[index++];
            await worker(item);
        }
    });
    await Promise.all(runners);
}

async function healthCheck() {
    for (let i = 1; i <= 10; i++) {
        const ok = await new Promise((resolve) => {
            const https = require("https");
            const req = https.get(HEALTH_URL, { headers: { "User-Agent": "Mozilla/5.0 deploy-check" }, timeout: 8000 }, (res) => {
                res.resume();
                resolve(res.statusCode === 200);
            });
            req.on("timeout", () => { req.destroy(); resolve(false); });
            req.on("error", () => resolve(false));
        });
        if (ok) { log("    live: 200 OK"); return true; }
        log("    health attempt " + i + "/10 not ready");
        await new Promise((r) => setTimeout(r, 3000));
    }
    return false;
}

/* ---------------- main ---------------- */

(async () => {
    requireConfig();
    const files = walk("").sort();
    log("1/5 local tree: " + files.length + " files");

    const conn = await connect();
    log("2/5 connected to " + HOST);
    try {
        const sftp = await sftpSession(conn);
        const manifestPath = APP_DIR + "/.deploy-manifest.json";
        let manifest = {};
        const remoteManifest = await statOrNull(sftp, manifestPath);
        if (remoteManifest) {
            try {
                manifest = JSON.parse((await call(sftp, "readFile", manifestPath)).toString("utf8"));
            } catch (err) { manifest = {}; }
        }

        const made = new Set();
        const todo = [];
        const nextManifest = {};
        for (const rel of files) {
            const localStat = fs.statSync(path.join(ROOT, rel));
            const stamp = localStat.size + ":" + Math.floor(localStat.mtimeMs);
            nextManifest[rel] = stamp;
            const remote = await statOrNull(sftp, APP_DIR + "/" + rel);
            if (!remote || remote.size !== localStat.size || manifest[rel] !== stamp) {
                todo.push({ rel, localStat });
            }
        }

        const vanished = Object.keys(manifest).filter((rel) => !(rel in nextManifest));
        log("3/5 changed: " + todo.length + " to upload, " + vanished.length + " to remove");

        if (DRY) {
            todo.slice(0, 40).forEach((f) => log("    + " + f.rel));
            if (todo.length > 40) log("    ... " + (todo.length - 40) + " more");
            vanished.forEach((rel) => log("    - " + rel));
            conn.end();
            return;
        }

        await pool(todo, 6, async ({ rel, localStat }) => {
            const remote = APP_DIR + "/" + rel;
            await ensureDir(sftp, path.posix.dirname(remote), made);
            await new Promise((resolve, reject) =>
                sftp.fastPut(path.join(ROOT, rel), remote, (err) => (err ? reject(err) : resolve()))
            );
            await call(sftp, "setstat", remote, { atime: Math.floor(localStat.atimeMs / 1000), mtime: Math.floor(localStat.mtimeMs / 1000) });
        });
        log("4/5 upload done");

        if (vanished.length) {
            await pool(vanished, 6, async (rel) => {
                try { await call(sftp, "unlink", APP_DIR + "/" + rel); } catch (err) { /* already gone */ }
            });
        }

        const lockLocal = fs.statSync(path.join(ROOT, "package-lock.json")).size;
        const lockRemote = await statOrNull(sftp, APP_DIR + "/package-lock.json");
        const depsChanged = !lockRemote || lockRemote.size !== lockLocal;

        await call(sftp, "writeFile", manifestPath, JSON.stringify(nextManifest, null, 1));

        await ensureDir(sftp, APP_DIR + "/tmp", made);
        await call(sftp, "writeFile", APP_DIR + "/tmp/restart.txt", "deploy " + new Date().toISOString() + "\n");
        log("    Passenger restart signalled");

        conn.end();

        if (depsChanged) {
            log("\nWARNING: package-lock.json changed but node_modules was not updated.");
            log("cPanel -> Setup Node.js App -> your app -> Run NPM Install, then restart.");
        }

        const healthy = await healthCheck();
        log(healthy ? "\nDeploy complete." : "\nFiles uploaded but health check failed.");
        if (!healthy) process.exitCode = 1;
    } finally {
        try { conn.end(); } catch (err) { /* closed */ }
    }
})().catch((err) => fail(err.message));
