# Product

<!-- impeccable:product-schema 1 -->

<!-- Source: 12_SPEC_v3.md §0 (positioning, fixed) and Malik's two-page structure of 2026-11-03. Written in place of the init interview, at Malik's instruction;
     replace or extend from docs/DESIGN_SYSTEM.md when that file lands from the board session. -->

## Platform

web (installable PWA; a phone collects, a desktop or a phone makes)

## Users

Builders: people building something of their own. Designers by day, design engineers, anyone who codes and wants it to feel like theirs. First users: someone mid side-project who saves visual references and still starts every screen by searching for new ones.

## Product Purpose

Save without thinking. Build with reasons. (放进去不用想，拿出来有理由。)

References saved months ago are useless the day you start building. Tearsheet keeps every photo you save as a brick: what the model measured in it, what it thinks makes it work, and the rules that would carry over. When you say what you are making, it finds the photos whose rules fit, often one you forgot, and shows those rules on two screens of your own product.

Success is the demo in two joined steps: tell it what you're making → it finds a photo you forgot you saved → you try one relation from it on your screen and decide whether it stays.

## Positioning

Retrieval alone is a search engine; parameters alone is "paste an image to an agent". Tearsheet joins them. It picks a photo because of a rule the photo carries, never because of what the photo shows, and every value on the screen says where it came from: measured, interpreted, adapted by you, or adapted by rule.

Not a design-system generator and not a restyler. Copy never compares it to Claude Design, Stitch, Lovable or component libraries. The only comparison is against a general chat given the same photos and the same task.

The last step is "hand it on" (a link that opens the screens and the reasons behind them), not "download".

## Structure

Two pages, one action each.

- **Library:** the photos you saved, by date. The one action: Shoot (save a photo). A photo opens a sheet with what it carries; its details (rules, measurements, hypotheses) stay one fold away.
- **Make:** one input, "What are you making?". The one action: Enter, which proposes up to three of your photos and shows two screens of your product built from them. Tapping a photo turns its contribution off and on. Share hands it on. Everything else (fine-tune, style, arrangements, picking by hand) is in ⋯.

## Constraints

- Provenance stays honest and visible where it matters (photo details, Fine-tune), and the product never claims a value is measured when a rule or a person set it.
- The two screens are the user's product, rendered from parameters alone. The chrome around them stays quiet so the screens lead.
- Chrome accent only on the primary action, the selected tab, a switch that is on, and the change highlight.
