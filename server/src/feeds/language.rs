//! An article's language, as the reading page marks it (decision 0223).
//!
//! Screen readers choose their voice by it, and browsers the shapes and
//! spacing of a script, so it has to be right. Feeds often leave it out, and
//! some give the wrong one (WordPress writes `en-US` unless the writer changes
//! a setting), so the feed's word is checked against the letters themselves:
//! when most of them are in a script that one language usually stands for
//! (Devanagari, Arabic, Hebrew, kana, Han, Hangul, Thai…), a feed that names
//! another language, or none, gives way to that script's usual language.
//! Scripts shared by many languages, such as the Latin and Cyrillic
//! alphabets, are never guessed: there the feed's word stands.

/// The language to mark an article with: the feed's `tag` when the text agrees
/// with it, otherwise the usual language of the script most of the text is
/// written in, otherwise nothing.
pub(crate) fn of(tag: Option<&str>, title: &str, text: &str) -> Option<String> {
    let written = written_in(title, text);
    match (tag, written) {
        (Some(tag), Some(script)) if script.languages.contains(&primary(tag).as_str()) => {
            Some(tag.to_owned())
        }
        (_, Some(script)) => Some(script.languages[0].to_owned()),
        // Mostly Latin letters (or another shared script): a tag that belongs to a
        // script we know isn't this text's, so it's left out rather than kept wrong.
        (Some(tag), None)
            if mostly_other_letters(title, text)
                && !ALSO_LATIN.contains(&primary(tag).as_str())
                && SCRIPTS
                    .iter()
                    .any(|s| s.languages.contains(&primary(tag).as_str())) =>
        {
            None
        }
        (Some(tag), None) => Some(tag.to_owned()),
        (None, None) => None,
    }
}

/// A script nine turtles can tell by its letters, and the languages usually
/// written in it, the commonest first (the one used when the feed says nothing).
struct Script {
    ranges: &'static [(u32, u32)],
    languages: &'static [&'static str],
}

/// Languages in the lists below that are often written in Latin letters too
/// (Kurmanji Kurdish, Azerbaijani, Malay): their tag stands on Latin text.
const ALSO_LATIN: &[&str] = &["ku", "az", "ms"];

/// Where kana and Han sit in `SCRIPTS`, which Japanese detection counts together.
const KANA: usize = 0;
const HAN: usize = 2;

const SCRIPTS: &[Script] = &[
    // Kana before Han: Japanese mixes both, Chinese uses no kana. Keep KANA and HAN above in step.
    Script {
        ranges: &[(0x3040, 0x30FF), (0x31F0, 0x31FF), (0xFF66, 0xFF9F)],
        languages: &["ja"],
    },
    Script {
        ranges: &[(0xAC00, 0xD7AF), (0x1100, 0x11FF), (0x3130, 0x318F)],
        languages: &["ko"],
    },
    Script {
        ranges: &[(0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF)],
        languages: &["zh", "ja", "yue", "nan", "hak", "wuu", "gan", "lzh"],
    },
    Script {
        ranges: &[(0x0900, 0x097F), (0xA8E0, 0xA8FF)],
        languages: &[
            "hi", "mr", "ne", "sa", "mai", "bho", "kok", "doi", "ks", "sd", "new",
        ],
    },
    Script {
        ranges: &[
            (0x0600, 0x06FF),
            (0x0750, 0x077F),
            (0x08A0, 0x08FF),
            (0xFB50, 0xFDFF),
            (0xFE70, 0xFEFF),
        ],
        languages: &[
            "ar", "fa", "ur", "ps", "ckb", "sd", "ug", "ku", "pa", "ks", "az", "bal", "ms",
        ],
    },
    Script {
        ranges: &[(0x0590, 0x05FF), (0xFB1D, 0xFB4F)],
        languages: &["he", "iw", "yi", "lad"],
    },
    Script {
        ranges: &[(0x0980, 0x09FF)],
        languages: &["bn", "as"],
    },
    Script {
        ranges: &[(0x0A00, 0x0A7F)],
        languages: &["pa"],
    },
    Script {
        ranges: &[(0x0A80, 0x0AFF)],
        languages: &["gu"],
    },
    Script {
        ranges: &[(0x0B80, 0x0BFF)],
        languages: &["ta"],
    },
    Script {
        ranges: &[(0x0C00, 0x0C7F)],
        languages: &["te"],
    },
    Script {
        ranges: &[(0x0C80, 0x0CFF)],
        languages: &["kn", "kok", "tcy"],
    },
    Script {
        ranges: &[(0x0D00, 0x0D7F)],
        languages: &["ml"],
    },
    Script {
        ranges: &[(0x0E00, 0x0E7F)],
        languages: &["th"],
    },
    Script {
        ranges: &[(0x0370, 0x03FF), (0x1F00, 0x1FFF)],
        languages: &["el", "grc"],
    },
    Script {
        ranges: &[(0x10A0, 0x10FF)],
        languages: &["ka"],
    },
    Script {
        ranges: &[(0x0530, 0x058F)],
        languages: &["hy"],
    },
];

/// The language part of a tag, in lower case (`en-US` is `en`).
fn primary(tag: &str) -> String {
    tag.split('-').next().unwrap_or("").to_ascii_lowercase()
}

fn script_of(c: char) -> Option<usize> {
    let code = c as u32;
    SCRIPTS.iter().position(|script| {
        script
            .ranges
            .iter()
            .any(|&(from, to)| (from..=to).contains(&code))
    })
}

/// The letters looked at: the title and the start of the text are enough.
fn letters<'a>(title: &'a str, text: &'a str) -> impl Iterator<Item = char> + 'a {
    title
        .chars()
        .chain(text.chars())
        .filter(|c| c.is_alphabetic())
        .take(2000)
}

/// The script more than half the letters are in, if there is one. Japanese
/// counts its kana and Han together, since a Japanese sentence is both.
fn written_in(title: &str, text: &str) -> Option<&'static Script> {
    let mut counts = [0usize; SCRIPTS.len()];
    let mut total = 0;
    for c in letters(title, text) {
        total += 1;
        if let Some(i) = script_of(c) {
            counts[i] += 1;
        }
    }
    if total == 0 {
        return None;
    }
    let (kana, han) = (KANA, HAN);
    if counts[kana] > 0
        && (counts[kana] + counts[han]) * 2 > total
        && counts[kana] * 20 >= counts[han]
    {
        return Some(&SCRIPTS[kana]);
    }
    counts
        .iter()
        .position(|&n| n * 2 > total)
        .map(|i| &SCRIPTS[i])
}

/// Whether most letters are in none of the scripts above (Latin, Cyrillic…).
fn mostly_other_letters(title: &str, text: &str) -> bool {
    let (mut other, mut total) = (0, 0);
    for c in letters(title, text) {
        total += 1;
        if script_of(c).is_none() {
            other += 1;
        }
    }
    total > 0 && other * 2 > total
}

#[cfg(test)]
mod tests {
    use super::of;

    #[test]
    fn a_feed_that_says_nothing_gets_its_scripts_language() {
        assert_eq!(
            of(None, "धीमी चिट्ठियों का मौसम", "पिछले महीने मैंने तय किया").as_deref(),
            Some("hi")
        );
        assert_eq!(
            of(None, "יומן הגינה", "הגשם הראשון הגיע השבוע").as_deref(),
            Some("he")
        );
        assert_eq!(
            of(
                None,
                "为什么我又开始用阅读器",
                "去年冬天，我删掉了手机上所有的推荐类应用。"
            )
            .as_deref(),
            Some("zh")
        );
        assert_eq!(
            of(
                None,
                "十一月の朝",
                "朝のコーヒーを淹れてから、好きな人たちのブログを読む。"
            )
            .as_deref(),
            Some("ja")
        );
        assert_eq!(
            of(None, "서울의 아침", "오늘 아침에는 비가 왔다.").as_deref(),
            Some("ko")
        );
    }

    #[test]
    fn a_wrong_english_tag_gives_way_to_the_letters() {
        assert_eq!(
            of(Some("en-US"), "दफ़्तर", "हर सुबह एक चिट्ठी").as_deref(),
            Some("hi")
        );
        assert_eq!(
            of(Some("en"), "دفتر الصباح", "منذ سنتين وأنا أبدأ يومي").as_deref(),
            Some("ar")
        );
    }

    #[test]
    fn a_tag_that_fits_the_letters_is_kept() {
        assert_eq!(of(Some("mr"), "पुणे", "आज पाऊस पडला").as_deref(), Some("mr"));
        assert_eq!(
            of(Some("fa-IR"), "کتاب", "امروز باران بارید").as_deref(),
            Some("fa-IR")
        );
        assert_eq!(
            of(Some("zh-Hant"), "閱讀", "我喜歡讀書").as_deref(),
            Some("zh-Hant")
        );
        assert_eq!(of(Some("ja"), "読書", "本を読む").as_deref(), Some("ja"));
    }

    #[test]
    fn shared_scripts_are_never_guessed() {
        assert_eq!(
            of(Some("fr"), "Le matin", "Il pleut ce matin.").as_deref(),
            Some("fr")
        );
        assert_eq!(
            of(None, "The morning", "It rained this morning.").as_deref(),
            None
        );
        assert_eq!(
            of(Some("ru"), "Утро", "Сегодня утром шёл дождь.").as_deref(),
            Some("ru")
        );
    }

    #[test]
    fn a_few_words_in_another_script_change_nothing() {
        assert_eq!(
            of(
                Some("en"),
                "Reading गोदान again, twenty years on",
                "I first read it at school, in a hurry."
            )
            .as_deref(),
            Some("en")
        );
    }

    #[test]
    fn kana_and_han_are_where_japanese_detection_looks() {
        assert_eq!(super::SCRIPTS[super::KANA].languages[0], "ja");
        assert_eq!(super::SCRIPTS[super::HAN].languages[0], "zh");
    }

    #[test]
    fn languages_that_share_a_script_keep_their_tag() {
        assert_eq!(of(Some("pa"), "لاہور", "اج مینہ پیا").as_deref(), Some("pa"));
        assert_eq!(
            of(Some("kok"), "ಕೊಂಕಣಿ", "ಆಜ್ ಪಾವ್ಸ್ ಪಡ್ಲೊ").as_deref(),
            Some("kok")
        );
        assert_eq!(of(Some("nan"), "台灣", "我愛讀冊").as_deref(), Some("nan"));
        assert_eq!(
            of(Some("grc"), "Ἰλιάς", "μῆνιν ἄειδε θεὰ").as_deref(),
            Some("grc")
        );
    }

    #[test]
    fn a_language_also_written_in_latin_letters_keeps_its_tag_there() {
        assert_eq!(
            of(Some("ku"), "Rojbaş", "Îro baran barî.").as_deref(),
            Some("ku")
        );
    }

    #[test]
    fn a_tag_for_another_script_is_dropped_from_latin_text() {
        assert_eq!(
            of(
                Some("hi"),
                "Notes from Pune",
                "This week I walked to the river every morning."
            )
            .as_deref(),
            None
        );
    }
}
