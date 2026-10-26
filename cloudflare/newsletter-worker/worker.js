// nine turtles' newsletter forwarder (SPEC section 28, decision 0091).
//
// Cloudflare Email Routing receives the emails sent to nine turtles'
// newsletter addresses and hands each one to this small program (a
// "Worker"). It posts the email, whole and unchanged, to nine turtles, with
// the shared secret as its key. nine turtles does everything else.
//
// When nine turtles answers "200 OK", the email is kept and that's the end.
// "No such address" and "replaced" (marked with the x-nine-turtles-answer
// header) bounce the email back to its sender: that's what replacing an
// address is for. Any other answer, a plain "404" included, (and nine turtles being out of reach)
// passes the email on to FORWARD_TO, an ordinary inbox, when one is set, so
// nothing is lost. Without FORWARD_TO, an email nine turtles refused is
// bounced, and one that couldn't be delivered right now is reported as an
// error, which tells the sender's mail service to try again later.
//
// Settings, in the Worker's "Settings → Variables and Secrets":
//   NINE_TURTLES_URL     where nine turtles is (set in wrangler.toml)
//   NINE_TURTLES_SECRET  the same text as nine turtles'
//                        NINE_TURTLES_NEWSLETTER_SECRET (a secret)
//   FORWARD_TO           optional: an address verified in Email Routing

// The biggest email nine turtles reads (EMAIL_SIZE_LIMIT in
// server/src/newsletters.rs; the check makes sure the two agree).
const SIZE_LIMIT = 10 * 1024 * 1024;

export default {
  async email(message, env) {
    if (message.rawSize > SIZE_LIMIT) {
      return elsewhere(message, env, null, "This email is too big for nine turtles.");
    }
    let answer = null;
    try {
      answer = await fetch(new URL("/newsletters/incoming", env.NINE_TURTLES_URL), {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.NINE_TURTLES_SECRET}`,
          "content-type": "message/rfc822",
          // Who it was delivered to: the email's own To may not say.
          "x-nine-turtles-to": message.to,
        },
        body: await new Response(message.raw).arrayBuffer(),
      });
    } catch {
      // Out of reach: handled below like any answer that isn't "kept".
    }
    if (answer && answer.status === 200) return;
    // Only nine turtles' own "no such address" bounces: a "404" without the
    // mark means nine turtles isn't taking newsletters, or NINE_TURTLES_URL is wrong.
    const said = answer ? answer.headers.get("x-nine-turtles-answer") : null;
    if (said === "no-such-address" || said === "replaced") {
      message.setReject("There is no such address at nine turtles.");
      return;
    }
    return elsewhere(message, env, answer, "nine turtles couldn't take this email.");
  },
};

// The email wasn't kept: pass it on, bounce it, or ask for it again later.
async function elsewhere(message, env, answer, reason) {
  if (env.FORWARD_TO) {
    await message.forward(env.FORWARD_TO);
    return;
  }
  const refused = answer !== null && answer.status >= 400 && answer.status < 500;
  if (refused || message.rawSize > SIZE_LIMIT) {
    message.setReject(reason);
    return;
  }
  throw new Error(`nine turtles answered ${answer ? answer.status : "nothing"}; try again later`);
}
