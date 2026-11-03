# 0151: Installing the app, said plainly

*3 November 2026. The shape was agreed with the owner (PLAN.md → V1, item
6, decision 0140); the owner gave advance permission to build and ship it
("Go on V1. Ship each one."). The smaller choices below were made by the
building agent while the owner was away, each listed for the owner's
refinement round.*

**Decision.** Settings › More › **Install the app** is a page of its own
(SPEC section 20). It opens with one sentence on what an installed web app
is: its own icon, its own window, nothing to download from an app store,
and it updates itself each time you open it. Then the numbered steps for
the device and browser it's opened on, then one line each for the other
devices. In the installed app itself, it says "You're using the installed
app now." instead of the steps. The guess at the device comes from what the
browser says about itself (`web/src/lib/install.ts`); a wrong guess only
changes which steps come first, since every device's steps are on the page.

**Choices made while the owner was away** (each easy to reverse):

1. **Where it lives:** a Settings page under More, just after Add from
   anywhere, rather than on the welcome or the website. Nothing pulls: no
   banner, no reminder, nothing that appears until the reader looks.
2. **One-press Install where the browser offers it.** Chrome, Edge and
   Android announce that a site can be installed; nine turtles keeps that
   offer and shows **Install nine turtles** above the steps, which opens the
   browser's own dialog. Safari and Firefox have no such offer, so they get
   steps only.
3. **Android's own install bar is held back,** so installing is offered only
   on this page (principle 1, "Nothing pulls"). Chrome's install icon in a
   computer's address bar is the browser's and stays.
4. **Firefox on a computer** gets no steps, only a plain line: it can't
   install web apps yet, so use Chrome, Edge or Safari, or pin the tab.
5. **The row's icon** is a new drawing in the locked style: a phone, line
   only, with its home bar (BRAND.md → Icons: "A new icon follows the same
   rule").
6. **The page's last line** says that signing in once on each device brings
   the same feeds, folders and reading everywhere, since that's the next
   question after installing on a second device.
