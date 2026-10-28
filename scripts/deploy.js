#!/usr/bin/env node
/**
 * Deploy the working tree to the live InMotion/Passenger server.
 *
 * Credentials come from .env.deploy (never committed) or from the
 * environment (used by GitHub Actions). Server .env is never uploaded
 * or overwritten.
 *
 *   npm run deploy            # full deploy
 *   npm run deploy -- --dry   # build + connect + show plan only
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { Client } = require("ssh2");

require("dotenv").config({ path: path.join(__dirname, "..", ".env.deploy"), quiet: true });

const ROOT = path.join(__dirname, "..");
const DRY = process.argv.includes("--dry");

const HOST = process.env.SSH_HOST;
const PORT = Number(process.env.SSH_PORT || 2222);
const USER = process.env.SSH_USER;
const PASS = process.env.SSH_PASS;
const KEY = process.env.SSH_KEY_PATH || (process.env.SSH_KEY ? materialiseKey(process.env.SSH_KEY) : "");

function materialiseKey(value) {
    const file = path.join(os.tmpdir(), "mizantrade-ci-key");
    fs.writeFileSync(file, value.replace(/\\n/g, "\n"), { mode: 0o600 });
    return file;
}
const APP_DIR = process.env.APP_DIR || "";
const HEALTH_URL = process.env.HEALTH_URL || "https://www.mizantrade.com/health";

const EXCLUDES = [
    "./.env",
    "./.env.*",
    "./.git",
    "./.qoder",
    "./node_modules",
    "./public/uploads",
    "./storage/private",
    "./tmp",
    "./server.log",
    "./*.log"
];

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
    if (!PASS && !KEY) missing.push("SSH_PASS or SSH_KEY_PATH");
    if (missing.length) {
        fail(
            "missing " + missing.join(", ") + " in D:\\mizantrade\\.env.deploy\n" +
            "Run: npm run deploy:setup   (creates the template)"
        );
    }
    if (!HOST || /^(your-|example)/i.test(HOST)) fail("SSH_HOST still holds the template value");
    if (KEY && !fs.existsSync(KEY.replace(/^~/, os.homedir()))) {
        fail("SSH_KEY_PATH not found: " + KEY);
    }
}

/* ---------------- local archive ---------------- */

function buildArchive() {
    // Keep the archive path relative: MSYS tar treats "C:\..." as a remote host.
    const tmpDir = path.join(ROOT, "tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
    const name = "deploy-" + Date.now() + ".tar.gz";
    const file = path.join(tmpDir, name);
    log("1/7 packing working tree (18MB, node_modules/.env/uploads excluded)");
    return new Promise((resolve, reject) => {
        const args = ["-czf", "tmp/" + name, "--exclude=node_modules", ...EXCLUDES.map((e) => "--exclude=" + e), "."];
        const tar = spawn("tar", args, { cwd: ROOT, stdio: ["ignore", "inherit", "pipe"] });
        let err = "";
        tar.stderr.on("data", (d) => { err += d.toString(); });
        tar.on("error", reject);
        tar.on("close", (code) => {
            if (code !== 0) return reject(new Error("tar failed: " + err.trim()));
            const size = (fs.statSync(file).size / 1048576).toFixed(1);
            log("    archive ready: " + size + " MB");
            verifyArchive(file).then(() => resolve(file)).catch(reject);
        });
    });
}

function verifyArchive(file) {
    return new Promise((resolve, reject) => {
        const tar = spawn("tar", ["-tzf", path.relative(ROOT, file)], { cwd: ROOT });
        let out = "";
        tar.stdout.on("data", (d) => { out += d.toString(); });
        tar.on("close", () => {
            const bad = out
                .split("\n")
                .filter((line) => /(^|\/)(\.env(\.[^/]*)?|server\.log);?$/i.test(line) && !/\.env\.example$/i.test(line));
            if (bad.length) return reject(new Error("secret file leaked into archive: " + bad[0]));
            log("    archive checked: no .env / log files inside");
            resolve();
        });
    });
}

/* ---------------- ssh plumbing ---------------- */

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
            tryKeyboard: true
        });
        conn.on("keyboard-interactive", (n, i, l, prompts, finish) => finish([PASS || ""]));
    });
}

function exec(conn, command) {
    return new Promise((resolve, reject) => {
        conn.exec(command, { pty: false }, (err, stream) => {
            if (err) return reject(err);
            let stdout = "";
            let stderr = "";
            stream.on("data", (d) => { stdout += d.toString(); });
            stream.stderr.on("data", (d) => { stderr += d.toString(); });
            stream.on("close", (code) => resolve({ code: code || 0, stdout: stdout.trim(), stderr: stderr.trim() }));
        });
    });
}

async function sh(conn, command) {
    return exec(conn, "bash -lc " + JSON.stringify(command));
}

function upload(conn, localFile, remoteFile) {
    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) return reject(err);
            const rs = fs.createReadStream(localFile);
            const ws = sftp.createWriteStream(remoteFile);
            ws.on("close", resolve);
            ws.on("error", reject);
            rs.pipe(ws);
        });
    });
}

async function findAppDir(conn) {
    if (APP_DIR) return APP_DIR;
    log("2/7 locating app root on server");
    const res = await sh(
        conn,
        "find \"$HOME\" -maxdepth 5 -name server.js -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null"
    );
    const candidates = res.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
    const withPackage = [];
    for (const dir of candidates) {
        const parent = dir.replace(/\/server\.js$/, "");
        const check = await sh(conn, "test -f " + JSON.stringify(parent + "/package.json") + " && echo yes");
        if (check.stdout === "yes") withPackage.push(parent);
    }
    if (withPackage.length === 0) fail("no app root (server.js + package.json) found under $HOME. Set APP_DIR in .env.deploy.");
    if (withPackage.length > 1) {
        log("    candidates:");
        withPackage.forEach((d) => log("      " + d));
        fail("multiple app roots found. Set APP_DIR in .env.deploy to the right one.");
    }
    log("    app root: " + withPackage[0]);
    return withPackage[0];
}

async function checkNode(conn, appDir) {
    log("3/7 checking Node on server");
    let res = await sh(conn, "cd " + JSON.stringify(appDir) + " && node -v && npm -v");
    if (res.code !== 0) {
        res = await sh(conn, "node -v && npm -v");
        if (res.code !== 0) fail("node/npm not on PATH in the non-interactive shell. Add a nodealias or set PATH in .bashrc.\n" + res.stderr);
    }
    log("    " + res.stdout.replace(/\n/g, " / "));
}

/* ---------------- health ---------------- */

async function healthCheck() {
    log("7/7 health check " + HEALTH_URL);
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
        log("    attempt " + i + "/10 not ready, retrying in 3s");
        await new Promise((r) => setTimeout(r, 3000));
    }
    return false;
}

/* ---------------- main ---------------- */

(async () => {
    requireConfig();
    log("Deploying to " + USER + "@" + HOST + ":" + PORT);

    const archive = await buildArchive();
    if (DRY) {
        log("dry run: skipping upload");
        fs.unlinkSync(archive);
        return;
    }

    const conn = await connect();
    log("    connected");

    try {
        const appDir = await findAppDir(conn);
        await checkNode(conn, appDir);

        const remoteTar = "mizantrade-deploy-" + Date.now() + ".tar.gz";
        const before = await sh(conn, "cd " + JSON.stringify(appDir) + " && md5sum package-lock.json 2>/dev/null | cut -d' ' -f1");
        const envCheck = await sh(conn, "cd " + JSON.stringify(appDir) + " && test -f .env && echo has-env || echo no-env");
        if (envCheck.stdout !== "has-env") {
            log("    WARNING: server has no .env — the app will not start. Copy the live .env manually first.");
        }

        log("4/7 uploading archive");
        await upload(conn, archive, remoteTar);

        log("5/7 extracting into " + appDir);
        const extract = await sh(
            conn,
            "cd " + JSON.stringify(appDir) + " && tar -xzf " + JSON.stringify(remoteTar) + " && rm -f " + JSON.stringify(remoteTar)
        );
        if (extract.code !== 0) fail("extract failed: " + extract.stderr);

        const after = await sh(conn, "cd " + JSON.stringify(appDir) + " && md5sum package-lock.json 2>/dev/null | cut -d' ' -f1");
        if (before.stdout !== after.stdout) {
            log("6/7 dependencies changed — npm install --omit=dev");
            const install = await sh(conn, "cd " + JSON.stringify(appDir) + " && npm install --omit=dev --no-audit --no-fund");
            log("    " + (install.stdout.split("\n").slice(-2).join(" ") || install.stderr.split("\n").slice(-2).join(" ")));
            if (install.code !== 0) fail("npm install failed: " + install.stderr);
        } else {
            log("6/7 dependencies unchanged — skipping npm install");
        }

        const restart = await sh(conn, "cd " + JSON.stringify(appDir) + " && mkdir -p tmp && touch tmp/restart.txt");
        if (restart.code !== 0) fail("restart failed: " + restart.stderr);
        log("    Passenger restart signalled");

        conn.end();
        const healthy = await healthCheck();
        log(healthy ? "\nDeploy complete." : "\nDeploy uploaded but health check failed — check Passenger log: " + appDir + "/stderr.log");
        if (!healthy) process.exitCode = 1;
    } finally {
        try { conn.end(); } catch (_) { /* already closed */ }
        fs.unlinkSync(archive);
    }
})().catch((err) => fail(err.message));
