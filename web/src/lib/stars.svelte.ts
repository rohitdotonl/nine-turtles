// Whether the reader has starred anything (SPEC section 18): Settings › Your
// data and the delete sheets offer "Export starred articles" only then, and
// otherwise say "Nothing starred yet", so no one downloads an empty file.
// Learned from the sidebar's feeds (`feeds.ts`) and from each star
// (`saving.ts`). Like Notes' `noted`, it only ever turns on: unstarring the
// last article still leaves its (empty) file to export.

/** Whether the reader has starred anything. */
export const stars = $state({ any: false });
