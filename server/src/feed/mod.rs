//! Reading a feed file (RSS, Atom or JSON Feed) into what nine turtles stores,
//! and giving each article its fingerprint (ENGINEERING.md → "Duplicates").
//!
//! Article content is cleaned here, before it's ever stored, so nothing
//! unsafe from a feed can reach the screen later (the engineering floor).
//! Invisible 1×1 tracking images, pictures from known trackers and the
//! tracking tags on links are taken out at the same time, and pictures are
//! set to load only as the reader reaches them (DESIGN.md → "Article
//! view", decision 0112). A YouTube video's own description becomes its text, and a
//! YouTube player embedded in an article becomes a link to the video (SPEC
//! section 7, decision 0072).
//!
//! Four parts: `parse` reads the file, `identity` gives fingerprints and
//! takes tracking tags off links, `clean` makes content safe to show, and
//! `whole` tells a summary from a whole post sent as one (decision 0218).
//! Everything is used as `feed::…`, whichever part it lives in.

mod clean;
mod identity;
mod parse;
mod whole;

pub use clean::*;
pub use identity::*;
pub use parse::*;
pub use whole::*;
