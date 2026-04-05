const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

function runCommand(command, args, options) {
  return new Promise((resolve) => {
    const safeCommand =
      typeof command === "string" && command.includes(" ") && !command.startsWith('"')
        ? `"${command}"`
        : command;
    const child = spawn(safeCommand, args, {
      ...options,
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}

function pauseAndExit(message, code = 1) {
  console.error(message);
  if (process.stdin.isTTY) {
    console.log("Press Enter to close...");
    process.stdin.resume();
    process.stdin.once("data", () => process.exit(code));
  } else {
    process.exit(code);
  }
}

function normalizePathEnv() {
  if (!process.env.PATH && process.env.Path) {
    process.env.PATH = process.env.Path;
  }
}

function findNodeInPath(pathValue) {
  if (!pathValue) {
    return null;
  }
  const entries = pathValue.split(";").map((entry) => entry.trim()).filter(Boolean);
  for (const entry of entries) {
    const candidate = path.join(entry, "node.exe");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveNodeExe(repoRoot) {
  const candidates = [
    process.env.NODE_EXE,
    repoRoot ? path.join(repoRoot, "tools", "node", "node.exe") : null,
    repoRoot ? path.join(repoRoot, "node", "node.exe") : null,
    findNodeInPath(process.env.PATH || process.env.Path),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveNpmCmd(nodeExePath) {
  if (!nodeExePath) {
    return "npm";
  }
  const npmCmd = path.join(path.dirname(nodeExePath), "npm.cmd");
  if (fs.existsSync(npmCmd)) {
    return npmCmd;
  }
  return "npm";
}

function getNodeMajorVersion(nodeExePath) {
  const command = nodeExePath || "node";
  const result = spawnSync(command, ["--version"], { encoding: "utf8", shell: true });
  if (result.status !== 0 || !result.stdout) {
    return null;
  }
  const match = result.stdout.trim().match(/^v(\d+)/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

async function main() {
  if (process.argv.includes("--check")) {
    console.log("launcher: ok");
    return;
  }

  normalizePathEnv();

  const cwdRoot = findRepoRoot(process.cwd());
  const exeRoot = findRepoRoot(path.dirname(process.execPath));
  const repoRoot = cwdRoot || exeRoot;

  if (!repoRoot) {
    pauseAndExit(
      "Could not find the repo root. Place this executable in the EchoWave repo folder and run it again."
    );
    return;
  }

  const nodeExePath = resolveNodeExe(repoRoot);
  const nodeMajor = getNodeMajorVersion(nodeExePath);
  if (!nodeMajor) {
    pauseAndExit("Node.js is required but was not found in PATH.");
    return;
  }
  if (nodeMajor < 20) {
    pauseAndExit("Node.js v20 or higher is required. Please install Node.js 20+ and try again.");
    return;
  }

  const npmCommand = resolveNpmCmd(nodeExePath);

  const nodeModulesPath = path.join(repoRoot, "node_modules");
  if (!fs.existsSync(nodeModulesPath)) {
    console.log("Installing dependencies...");
    const installCode = await runCommand(npmCommand, ["install"], {
      cwd: repoRoot,
    });
    if (installCode !== 0) {
      pauseAndExit("npm install failed.", installCode);
      return;
    }
  }

  console.log("Building apps (production)...");
  const buildCode = await runCommand(npmCommand, ["run", "build"], {
    cwd: repoRoot,
    env: { ...process.env, NODE_ENV: "production" },
  });
  if (buildCode !== 0) {
    pauseAndExit("Build failed.", buildCode);
    return;
  }

  console.log("Starting server and client...");
  const startCode = await runCommand(npmCommand, ["run", "start"], {
    cwd: repoRoot,
    env: { ...process.env, NODE_ENV: "production" },
  });

  if (startCode !== 0) {
    pauseAndExit("Start failed.", startCode);
  }
}

main().catch((error) => {
  pauseAndExit(error?.stack || String(error));
});
