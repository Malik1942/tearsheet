/** Propose prompt (PRD P2). Text only: the model sees the intent and each brick's rules with their parameter, never a photo, a measurement
 *  or a hypothesis. The same text, with the three placeholders filled the same way, is what meta-eval/fixtures/prompts/propose.md sends
 *  (scripts/propose.sh); the sha of this string is recorded in the README. {{LEAN}} is empty without a lean (spec v3 P5); the ranking sentence
 *  after it (swap sheet, 2026-11-03) and the content sentence after that (shell item 1, with {{YEAR}}) are the only changes to the v1 text besides the
 *  slot, and neither changes the pick instructions. */
export const PROPOSE_PROMPT = `You are helping a designer choose reference material from their own library.

They are about to make: "{{INTENT}}"

The library below is a list of bricks. A brick is one photo the designer saved, reduced to its transferable rules: one sentence each, written by a vision model that read the photo, with the layout parameter the rule maps to ("none" means no parameter carries it). You see only the rules, never the photos.

Pick the bricks whose rules would serve what they are making. At most three; fewer when fewer fit; none when none fit.
For each pick:
- brick_id: the id exactly as listed.
- quoted_rule: ONE rule of that brick, copied character for character. Do not paraphrase, shorten or fix it. If no rule of the brick can be quoted, do not pick the brick.
- why: one sentence on how that rule serves what they are making. Plain language; no new claims about the photo.
Prefer picks whose quoted rules map to different parameters. Do not pick the same brick twice.{{LEAN}}

Also return ranking: up to ten brick_ids from the library, best fit first for what they are making, each once, by the same preferences as your picks.

Also return content: placeholder text for the two screens of what they are making, written from the intent alone, never from a photo or a rule. screen_titles: list, the title of the screen that lists the items, and review, the title of the screen that looks back on the year. tabs: three short labels for a list, a chart and a profile tab, none repeating a screen title. entries: eight items, each with a short title, a subtitle, a date in {{YEAR}} (YYYY-MM-DD, spread over the year) and up to two one-word tags.

Library:
{{LIBRARY}}`
