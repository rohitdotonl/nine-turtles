// A made-up mail server for the browser tests (decision 0088), on this
// computer only. It speaks just enough SMTP for nine turtles to hand it an
// email, keeps every email in memory, and shows them over plain HTTP, so a
// test can follow the link in one. Nothing is ever sent anywhere. Uses only
// what comes with Node, so it needs no libraries.
//
//   SMTP on MAIL_SERVER_SMTP_PORT (4324): any login is accepted
//   GET /             "ready", for Playwright to wait on
//   GET /mail?to=ADDR every email sent to ADDR, oldest first, as JSON:
//                     [{ "to", "subject", "body" }]

import { createServer as createHttp } from "node:http";
import { createServer as createSmtp } from "node:net";

const smtpPort = Number(process.env.MAIL_SERVER_SMTP_PORT ?? 4324);
const httpPort = Number(process.env.MAIL_SERVER_HTTP_PORT ?? 4325);

/** Every email received: { to: string[], subject, body }. */
const mail = [];

createSmtp((socket) => {
  socket.setEncoding("latin1");
  let buffer = "";
  let reading = false;
  let data = "";
  let to = [];
  const say = (line) => socket.write(`${line}\r\n`);
  say("220 mail.test ready");
  socket.on("data", (chunk) => {
    buffer += chunk;
    for (;;) {
      if (reading) {
        const end = buffer.indexOf("\r\n.\r\n");
        if (end === -1) return;
        data += buffer.slice(0, end);
        buffer = buffer.slice(end + 5);
        reading = false;
        mail.push({ to, ...parse(data) });
        data = "";
        to = [];
        say("250 kept");
        continue;
      }
      const end = buffer.indexOf("\r\n");
      if (end === -1) return;
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const verb = line.slice(0, 4).toUpperCase();
      if (verb === "EHLO") {
        say("250-mail.test");
        say("250-AUTH PLAIN LOGIN");
        say("250 8BITMIME");
      } else if (verb === "HELO") say("250 mail.test");
      else if (verb === "AUTH") say("235 welcome");
      else if (verb === "MAIL") say("250 ok");
      else if (verb === "RCPT") {
        to.push(/<([^>]*)>/.exec(line)?.[1]?.toLowerCase() ?? "");
        say("250 ok");
      } else if (verb === "DATA") {
        reading = true;
        // The blank line after DATA's reply starts the message; a lone "." ends it.
        buffer = `\r\n${buffer}`;
        say("354 go on");
      } else if (verb === "QUIT") {
        say("221 bye");
        socket.end();
      } else if (verb === "RSET" || verb === "NOOP") say("250 ok");
      else say("502 not here");
    }
  });
  socket.on("error", () => {});
}).listen(smtpPort, "127.0.0.1");

/** The subject and the plain-text body of one email, its encoding undone. */
function parse(text) {
  const message = text.replace(/^\r\n/, "");
  const split = message.indexOf("\r\n\r\n");
  const head = message.slice(0, split).replace(/\r\n[ \t]+/g, " ");
  let body = message.slice(split + 4).replace(/^\.\./gm, ".");
  const header = (name) => new RegExp(`^${name}:\\s*(.*)$`, "im").exec(head)?.[1]?.trim() ?? "";
  const encoding = header("Content-Transfer-Encoding").toLowerCase();
  if (encoding === "quoted-printable") {
    body = body.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } else if (encoding === "base64") {
    body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("latin1");
  }
  return { subject: header("Subject"), body: Buffer.from(body.replace(/\r\n/g, "\n"), "latin1").toString("utf8") };
}

createHttp((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${httpPort}`);
  if (url.pathname === "/mail") {
    const wanted = (url.searchParams.get("to") ?? "").toLowerCase();
    const found = mail.filter((one) => one.to.includes(wanted)).map((one) => ({ ...one, to: wanted }));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(found));
    return;
  }
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("ready");
}).listen(httpPort, "127.0.0.1");
