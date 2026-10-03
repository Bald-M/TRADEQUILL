# Offline quotation font

`TradeQuillSans-Regular.ttf` is the regular-weight TrueType build of Noto Sans SC,
renamed to TradeQuill Sans for this distribution. It is used only by the Rust PDF
exporter, embedded into generated quotations, and never fetched at runtime.

- Upstream: [Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc)
- Font source: [Google Fonts regular TrueType build](https://fonts.gstatic.com/s/notosanssc/v41/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.ttf)
- License: SIL Open Font License 1.1, reproduced in `OFL.txt`.
- Transformation: fontTools 4.66.1; instantiate weight 400 if variable, and rename
  name-table records 1, 3, 4, 6 and 16. Glyph coverage is unchanged.

The font supports the quotation's Chinese/English template. Unsupported characters
produce an explicit export error rather than silently missing glyphs.
