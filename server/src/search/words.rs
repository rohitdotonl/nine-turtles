//! Words as search sees them, in every script (SPEC sections 14 and 24,
//! decision 0228).
//!
//! Most languages put spaces between words, so a word is a run of letters.
//! Chinese and Japanese don't: a sentence is one unbroken run of characters,
//! and a word is two or three of them anywhere in it. So each Chinese
//! character and each kana is a word of its own here, and a searched word in
//! them is those characters found side by side, in order ("阅读器" is 阅, 读
//! and 器 together). Arabic and Hebrew may write their short vowels as marks
//! above and below the letters, or leave them out; they are left out here, so
//! a word finds the same word written either way. The index, the question
//! sent to it and the excerpt all go through this one file, so they agree.

/// A Chinese character (Han, as Japanese and Korean use them too) or a kana:
/// in a language written without spaces, a word of its own.
pub(crate) fn is_ideograph(c: char) -> bool {
    matches!(c,
        '\u{3040}'..='\u{30FF}'
        | '\u{31F0}'..='\u{31FF}'
        | '\u{3400}'..='\u{4DBF}'
        | '\u{4E00}'..='\u{9FFF}'
        | '\u{F900}'..='\u{FAFF}'
        | '\u{FF66}'..='\u{FF9F}'
        | '\u{20000}'..='\u{3134F}')
}

/// Whether two pieces of text need a space between them to stay apart: not
/// beside a Chinese character, a kana or Chinese and Japanese punctuation,
/// where a space would be one the writer never typed.
pub(crate) fn need_space(before: &str, after: &str) -> bool {
    let wide =
        |c: char| is_ideograph(c) || matches!(c, '\u{3000}'..='\u{303F}' | '\u{FF00}'..='\u{FF65}');
    !before.chars().next_back().is_some_and(wide) && !after.chars().next().is_some_and(wide)
}

/// A short vowel or other reading mark of Arabic or Hebrew, which writers
/// may add or leave out (harakat, niqqud and the Bible's cantillation marks).
fn is_vowel_mark(c: char) -> bool {
    matches!(c,
        '\u{064B}'..='\u{065F}'
        | '\u{0670}'
        | '\u{0591}'..='\u{05BD}'
        | '\u{05BF}'
        | '\u{05C1}'..='\u{05C2}'
        | '\u{05C4}'..='\u{05C5}'
        | '\u{05C7}')
}

/// Text as the search index is given it: without vowel marks, and with a
/// space around each Chinese character and kana, so FTS5 (which splits words
/// at spaces and punctuation) keeps each as a word.
pub(crate) fn searchable(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars().filter(|&c| !is_vowel_mark(c)) {
        if is_ideograph(c) {
            out.push(' ');
            out.push(c);
            out.push(' ');
        } else {
            out.push(c);
        }
    }
    out
}

/// A character that belongs to a word, as the search index splits words:
/// letters, numbers and the marks that join them (`super::FTS5_TOKENIZER`).
fn is_word_char(c: char) -> bool {
    c.is_alphanumeric()
        || matches!(c,
            '\u{0300}'..='\u{036F}'
            | '\u{0483}'..='\u{0489}'
            | '\u{0591}'..='\u{05C7}'
            | '\u{0610}'..='\u{061A}'
            | '\u{064B}'..='\u{065F}'
            | '\u{0670}'
            | '\u{0900}'..='\u{0903}'
            | '\u{093A}'..='\u{094F}'
            | '\u{0951}'..='\u{0957}'
            | '\u{0962}'..='\u{0963}'
            | '\u{0981}'..='\u{0983}'
            | '\u{1AB0}'..='\u{1AFF}'
            | '\u{1DC0}'..='\u{1DFF}'
            | '\u{20D0}'..='\u{20FF}'
            | '\u{FE20}'..='\u{FE2F}')
}

/// Where each word starts and ends in `text`, in bytes. Each Chinese
/// character and kana is a word of its own.
pub(super) fn word_spans(text: &str) -> Vec<(usize, usize)> {
    let mut spans = Vec::new();
    let mut start = None;
    for (at, c) in text.char_indices() {
        if let Some(begun) = start
            && (!is_word_char(c) || is_ideograph(c))
        {
            spans.push((begun, at));
            start = None;
        }
        if is_ideograph(c) {
            spans.push((at, at + c.len_utf8()));
        } else if is_word_char(c) && start.is_none() {
            start = Some(at);
        }
    }
    if let Some(begun) = start {
        spans.push((begun, text.len()));
    }
    spans
}

/// A Latin letter without its accent, as the index's `remove_diacritics`
/// compares them ("cafe" finds "café").
fn base_letter(c: char) -> char {
    match c {
        'à'..='å' | 'ā' | 'ă' | 'ą' => 'a',
        'ç' | 'ć' | 'ĉ' | 'ċ' | 'č' => 'c',
        'ď' | 'đ' => 'd',
        'è'..='ë' | 'ē' | 'ĕ' | 'ė' | 'ę' | 'ě' => 'e',
        'ĝ' | 'ğ' | 'ġ' | 'ģ' => 'g',
        'ĥ' | 'ħ' => 'h',
        'ì'..='ï' | 'ĩ' | 'ī' | 'ĭ' | 'į' | 'ı' => 'i',
        'ĵ' => 'j',
        'ķ' => 'k',
        'ĺ' | 'ļ' | 'ľ' | 'ŀ' | 'ł' => 'l',
        'ñ' | 'ń' | 'ņ' | 'ň' => 'n',
        'ò'..='ö' | 'ø' | 'ō' | 'ŏ' | 'ő' => 'o',
        'ŕ' | 'ŗ' | 'ř' => 'r',
        'ś' | 'ŝ' | 'ş' | 'š' => 's',
        'ţ' | 'ť' | 'ŧ' => 't',
        'ù'..='ü' | 'ũ' | 'ū' | 'ŭ' | 'ů' | 'ű' | 'ų' => 'u',
        'ŵ' => 'w',
        'ý' | 'ÿ' | 'ŷ' => 'y',
        'ź' | 'ż' | 'ž' => 'z',
        other => other,
    }
}

/// A word as search compares it: small letters, Latin accents and Arabic and
/// Hebrew vowel marks set aside.
fn fold(word: &str) -> String {
    word.chars()
        .flat_map(char::to_lowercase)
        .filter(|&c| !matches!(c, '\u{0300}'..='\u{036F}') && !is_vowel_mark(c))
        .map(base_letter)
        .collect()
}

/// One searched word, as `fold` gives it: one word of letters, or a run of
/// Chinese characters or kana to be found side by side.
pub(super) type Term = Vec<String>;

/// The searched words. Each is found at the start of a word in the text, as
/// the search itself matches ("read" finds "reading"); a run of Chinese
/// characters or kana is found as those characters together.
pub(super) fn searched_words(typed: &str) -> Vec<Term> {
    let mut terms: Vec<Term> = Vec::new();
    let mut run_ends = None;
    for (start, end) in word_spans(typed) {
        let word = fold(&typed[start..end]);
        if word.is_empty() {
            continue;
        }
        let ideograph = typed[start..end].chars().all(is_ideograph);
        match terms.last_mut() {
            Some(run) if ideograph && run_ends == Some(start) => run.push(word),
            _ => terms.push(vec![word]),
        }
        run_ends = ideograph.then_some(end);
    }
    terms
}

/// How many of the words from `spans[at]` on make up `term`, or 0 if it isn't
/// there: the last of them may be longer than the searched word, and a run of
/// characters must stand side by side.
pub(super) fn found_at(text: &str, spans: &[(usize, usize)], at: usize, term: &Term) -> usize {
    let Some(words) = spans.get(at..at + term.len()) else {
        return 0;
    };
    let together = words.windows(2).all(|pair| pair[0].1 == pair[1].0);
    let last = term.len() - 1;
    let each = words
        .iter()
        .zip(term)
        .enumerate()
        .all(|(i, (&(start, end), searched))| {
            let word = fold(&text[start..end]);
            if i == last {
                word.starts_with(searched.as_str())
            } else {
                word == *searched
            }
        });
    if together && each { term.len() } else { 0 }
}

/// Whether `text` holds every searched word.
pub(super) fn holds_all(text: &str, searched: &[Term]) -> bool {
    let spans = word_spans(text);
    searched
        .iter()
        .all(|term| (0..spans.len()).any(|at| found_at(text, &spans, at, term) > 0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chinese_and_japanese_characters_become_words_of_their_own() {
        assert_eq!(searchable("用阅读器。"), " 用  阅  读  器 。");
        assert_eq!(searchable("Rust语言"), "Rust 语  言 ");
        assert_eq!(searchable("手紙を書く"), " 手  紙  を  書  く ");
        assert_eq!(searchable("서울의 아침"), "서울의 아침");
    }

    #[test]
    fn arabic_and_hebrew_vowel_marks_are_left_out() {
        assert_eq!(searchable("القِرَاءَة"), "القراءة");
        assert_eq!(searchable("שָׁלוֹם"), "שלום");
        // Hindi's vowel signs are part of its letters, and stay.
        assert_eq!(searchable("किताबें"), "किताबें");
    }

    #[test]
    fn a_run_of_characters_is_searched_as_one_word() {
        assert_eq!(
            searched_words("阅读器 slow 手紙"),
            vec![
                vec!["阅".to_owned(), "读".to_owned(), "器".to_owned()],
                vec!["slow".to_owned()],
                vec!["手".to_owned(), "紙".to_owned()],
            ]
        );
    }

    #[test]
    fn characters_are_found_only_side_by_side() {
        let searched = searched_words("阅读器");
        assert!(holds_all("我又开始用阅读器了", &searched));
        assert!(!holds_all("阅读，然后器", &searched));
        assert!(holds_all("القِرَاءَة جميلة", &searched_words("القراءة")));
        assert!(holds_all("Slow reading", &searched_words("read")));
    }
}
