# Palette validation — the record, not the recollection

The Critic's finding, 2026-09-19: the hex values are in the page, but nothing in the repo showed
the validator ran or what it returned, so the claim rested on the author's word. It does not now.

Run from the dataviz skill's own validator, `scripts/validate_palette.js`:

```
$ node scripts/validate_palette.js "#C2410C,#0369A1" --mode light

Palette (light, surface #fcfcfb, categorical): 2 slots
  [PASS] Lightness band         all 2 inside L 0.43–0.77
  [PASS] Chroma floor           all 2 >= 0.1
  [PASS] CVD separation         worst adjacent #0369A1↔#C2410C ΔE 20.1 (protan) · tritan 30.8
  [PASS] Normal-vision floor    worst adjacent #0369A1↔#C2410C ΔE 29.2 (normal)
  [PASS] Contrast vs surface    all 2 >= 3:1

  → ALL CHECKS PASS  (CVD in the 6–8 floor band is legal ONLY with secondary encoding: direct labels, gaps, or texture)
  scope: categorical palettes only. For a lone status/text color check WCAG text contrast; for a sequential ramp, lightness monotonicity.


$ node scripts/validate_palette.js "#D9762A,#2795C4" --mode dark --surface "#15181e"

Palette (dark, surface #15181e, categorical): 2 slots
  [PASS] Lightness band         all 2 inside L 0.48–0.67
  [PASS] Chroma floor           all 2 >= 0.1
  [PASS] CVD separation         worst adjacent #2795C4↔#D9762A ΔE 20.4 (protan) · tritan 28.6
  [PASS] Normal-vision floor    worst adjacent #2795C4↔#D9762A ΔE 26.9 (normal)
  [PASS] Contrast vs surface    all 2 >= 3:1

  → ALL CHECKS PASS  (CVD in the 6–8 floor band is legal ONLY with secondary encoding: direct labels, gaps, or texture)
  scope: categorical palettes only. For a lone status/text color check WCAG text contrast; for a sequential ramp, lightness monotonicity.

```
