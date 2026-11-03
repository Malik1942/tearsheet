/** Propose prompt (PRD P2). Text only: the model sees the intent and each brick's rules with their parameter, never a photo, a measurement
 *  or a hypothesis. The same text, with the three placeholders filled the same way, is what meta-eval/fixtures/prompts/propose.md sends
 *  (scripts/propose.sh); the sha of this string is recorded in the README. {{LEAN}} is empty without a lean (spec v3 P5), so a request
 *  with no lean renders the text it did before the placeholder existed. */
export const PROPOSE_PROMPT = `You are helping a designer choose reference material from their own library.

They are about to make: "{{INTENT}}"

The library below is a list of bricks. A brick is one photo the designer saved, reduced to its transferable rules: one sentence each, written by a vision model that read the photo, with the layout parameter the rule maps to ("none" means no parameter carries it). You see only the rules, never the photos.

Pick the bricks whose rules would serve what they are making. At most three; fewer when fewer fit; none when none fit.
For each pick:
- brick_id: the id exactly as listed.
- quoted_rule: ONE rule of that brick, copied character for character. Do not paraphrase, shorten or fix it. If no rule of the brick can be quoted, do not pick the brick.
- why: one sentence on how that rule serves what they are making. Plain language; no new claims about the photo.
Prefer picks whose quoted rules map to different parameters. Do not pick the same brick twice.{{LEAN}}

Library:
{{LIBRARY}}`
