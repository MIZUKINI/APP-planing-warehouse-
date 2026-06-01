import { spawn } from "node:child_process";

const port = 3001;
const server = spawn(process.execPath, ["scripts/static-demo-server.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) return;
    } catch {
      // retry while the server starts
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Static demo server did not start. Logs:\n${output}`);
}

try {
  await waitForServer();
  const health = await fetch(`http://localhost:${port}/health`).then((response) => response.json());
  const html = await fetch(`http://localhost:${port}`).then((response) => response.text());
  const requiredMarkers = [
    "Logowanie demo",
    "Plan produkcyjny",
    "Lista braków",
    "Logi kierownika",
    "Baza JSON",
    "data-tab",
    "data-pick",
    "data-arrived",
    "T23/01/2026",
    "Zatwierdź braki",
    "Pokaż dojechane"
  ];
  const missing = requiredMarkers.filter((marker) => !html.includes(marker));

  if (!health.ok) {
    throw new Error("Health endpoint returned not-ok response.");
  }

  if (missing.length) {
    throw new Error(`Static demo is missing markers: ${missing.join(", ")}`);
  }

  console.log("static demo smoke passed");
  console.log("checked markers:", requiredMarkers.join(", "));
} finally {
  server.kill("SIGTERM");
}
