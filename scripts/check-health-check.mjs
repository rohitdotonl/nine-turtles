// Tests scripts/health-check.sh (decision 0074) against a pretend nine turtles
// on this computer: it must pass when the status page says "nine turtles is
// running", and fail when the page says something else or nothing answers.

import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { join } from "node:path";

const script = join(import.meta.dirname, "health-check.sh");
const problems = [];

function serve(body) {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      response.end(request.url === "/status" ? body : "a web page");
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function run(address) {
  return new Promise((resolve) => {
    const env = { ...process.env, HEALTH_CHECK_TRIES: "2", HEALTH_CHECK_WAIT: "0", NO_PROXY: "127.0.0.1", no_proxy: "127.0.0.1" };
    execFile("bash", [script, address], { env }, (error, stdout) => resolve({ ok: !error, stdout }));
  });
}

async function expect(what, body, wanted, slash = "") {
  const server = body === null ? null : await serve(body);
  const port = server ? server.address().port : 9; // port 9: nothing answers
  const { ok, stdout } = await run(`http://127.0.0.1:${port}${slash}`);
  server?.close();
  if (ok !== wanted) problems.push(`${what}: expected ${wanted ? "a pass" : "a failure"}, got\n${stdout}`);
}

await expect("a running app", "nine turtles is running\nversion 1.0 abc1234\n", true);
await expect("an address ending in /", "nine turtles is running\nversion 1.0 abc1234\n", true, "/");
await expect("a wrong answer", "Bad gateway", false);
await expect("nothing answering", null, false);

if (problems.length) {
  console.error(problems.join("\n\n"));
  process.exit(1);
}
console.log("Health check script passed (4 cases).");
