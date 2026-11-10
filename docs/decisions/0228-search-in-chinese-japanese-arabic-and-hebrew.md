# 0228: Search in Chinese, Japanese, Arabic and Hebrew

*10 November 2026. Approved by the owner ("just implement your suggestions"),
OS-7 in the "other scripts" critique.*

**What we decided.** Search finds words in Chinese and Japanese, and finds
Arabic and Hebrew words whether or not their short vowels are written.

- **Chinese and Japanese** put no spaces between words, so FTS5 (which
  splits words at spaces and punctuation) saw a whole sentence as one word,
  and nothing typed found anything. Now each Chinese character and kana is a
  word of its own, and a searched word is found where its characters stand
  side by side, in order: "阅读器" finds 阅, 读 and 器 together, anywhere in
  a sentence, and never apart.
- **Arabic and Hebrew** may write short vowels as marks above and below the
  letters (harakat, niqqud), or leave them out. The marks are now set aside on
  both sides, so "القراءة" finds "القِرَاءَة" and the other way round. Hindi's
  vowel signs are part of its letters and stay (decision 0004).

**How.** One file, `server/src/search/words.rs`, says what a word is: the
index is given text with a space around each character and no vowel marks,
the question is made the same way (a run of characters becomes a phrase), and
the excerpt marks the characters found. Hiding (SPEC section 27) cuts words
the same way, so hiding "推荐" hides articles with it in a sentence. The
screen's bold in titles (`web/src/lib/search.ts`) uses the same character
ranges. FTS5's word-splitting setting is unchanged.

**The index is rebuilt once.** Structure change 47 empties the search index;
on the next start nine turtles fills it again in the background
(`search::index_missing`), so for a few minutes after that deploy older
articles may be missing from results. No article, note or mark is touched,
and a backup is taken first, as before every structure change (decision 0076).

**Rejected.** A dictionary that cuts Chinese and Japanese into real words
(such as ICU or a segmenter library): a new library, large, and wrong often
enough on short names that one character at a time, matched side by side, is
both simpler and finds more. FTS5's own trigram splitter: its index is
several times larger, and it finds nothing shorter than three characters,
which is most Chinese words.
