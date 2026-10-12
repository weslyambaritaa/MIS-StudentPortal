The four HTML entrypoints print the original, two-page Letter-size documents.
Their `artwork/*.svg` assets are vector exports of the supplied master PDFs;
they retain the logo, glyph shapes, table headings, clauses and page layout.
The original embedded fonts are reused for replacement text.

`quotation-document.ts` replaces only the identity, course table body,
repeated client references, shared bank details and sales signature. Course
tables keep the master columns: Public uses a per-pax price; Online uses pax,
per-pax price and total; Private/Inhouse use pax, total and additional per-pax
price. Prices exclude VAT, as stated in the masters. Rows are measured after
font loading and word wrapping, then resized to their content. The original VAT
row and clauses move up with a shorter table; headers and page footers stay
pinned. Extra courses receive continuation pages rather than covering the terms.
Scheduled dates remain TBA.

Embedded PDF fonts are subsets, not complete fonts. `artwork/fonts.json` combines
complementary subsets from all four supplied PDFs with explicit Unicode ranges,
so every Calibri/Calibri Bold digit uses the intended font (including `9`). All
numeric table cells use this complete Calibri digit family; bank configuration
stays unchanged. Do not replace this with a single PDF's incomplete subset.

Do not rewrite fixed clauses to reconcile spelling or differences between
types: preserve the supplied documents. The shared bank constant remains the
intentional business override. Online/Inhouse preserve the masters' two-week
confirmation periods; Private/Public preserve one week.

When the masters change, rerun `scripts/quotations/prepare-reference-assets.sh`
and `extract-reference-fonts.cjs`, then review the replacement coordinates.
`review-render.sh` generates reference clones, sample quotations and previews.
`compare-render.cjs` checks all eight pages against reference rasterizations
with one-pixel edge matching and a maximum average difference of one grayscale
level (PDF-font hinting versus SVG-glyph antialiasing). It separately requires
pixel-identical artwork outside dynamic/reflow regions when comparing a template
clone to a generated quotation. Browser tests separately verify compact row
heights, matching tail transforms and actual Calibri font usage for bank/numeric
text. This does not assert byte-identical PDF files or
identical antialiasing between renderers. Review PDFs are generated under
`.tmp-quotation-review/` at repo root.
