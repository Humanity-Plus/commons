---
"humanity-plus-commons": patch
---

Report fix: the Dependencies (WARM) table no longer overflows its card. Long unbreakable content in the Notes column — 40-char commit SHAs, command strings in inline code, embedded markdown tables — used to set the column width, pushing the table past the card edge and crushing the Package column to one word per line. The table now uses fixed layout with proportional columns, and inline code and embedded tables wrap inside the Notes cell.
