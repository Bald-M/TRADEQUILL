//! Offline, customer-facing quotation export. Only quotation fields are selected;
//! catalog notes, suppliers and order costs never enter the document.
use crate::storage::commerce::QuoteDocument;
use flate2::{write::ZlibEncoder, Compression};
use pdf_writer::{
    types::{CidFontType, FontFlags, SystemInfo, UnicodeCmap},
    Content, Filter, Finish, Name, Pdf, Rect, Ref, Str, TextStr,
};
use std::{collections::BTreeMap, io::Write, path::Path};

const FONT: &[u8] = include_bytes!("../fonts/TradeQuillSans-Regular.ttf");
const WIDTH: f32 = 511.0;
struct TextLine {
    text: String,
    size: f32,
    x: f32,
    y: f32,
}
struct Layout<'a> {
    face: ttf_parser::Face<'a>,
    pages: Vec<Vec<TextLine>>,
    y: f32,
}

impl Layout<'_> {
    fn advance(&self, character: char, size: f32) -> Result<f32, String> {
        let glyph = self.face.glyph_index(character).ok_or_else(|| {
            format!("报价包含字体不支持的字符「{character}」，请更正后重试导出。")
        })?;
        Ok(f32::from(self.face.glyph_hor_advance(glyph).unwrap_or(0))
            / f32::from(self.face.units_per_em())
            * size)
    }
    fn line(&mut self, text: String, size: f32) {
        if self.y < 60.0 {
            self.pages.push(Vec::new());
            self.y = 742.0;
        }
        self.pages
            .last_mut()
            .expect("layout always has a page")
            .push(TextLine {
                text,
                size,
                x: 42.0,
                y: self.y,
            });
        self.y -= size * 1.65;
    }
    fn paragraph(&mut self, text: &str, size: f32) -> Result<(), String> {
        for paragraph in text.replace('\t', "    ").replace('\r', "").split('\n') {
            let mut line = String::new();
            let mut width = 0.0;
            for character in paragraph.chars() {
                let advance = self.advance(character, size)?;
                if width + advance > WIDTH && !line.is_empty() {
                    self.line(std::mem::take(&mut line), size);
                    width = 0.0;
                }
                line.push(character);
                width += advance;
            }
            self.line(line, size);
        }
        self.y -= 4.0;
        Ok(())
    }
}

fn content(quote: &QuoteDocument, layout: &mut Layout<'_>) -> Result<(), String> {
    let fields = &quote.fields;
    layout.paragraph(&fields.seller, 12.0)?;
    layout.paragraph(
        &format!(
            "客户 / Customer: {}\n{}\n{}  {}\n{}",
            quote.customer.name,
            quote.customer.company,
            quote.customer.email,
            quote.customer.phone,
            quote.customer.country
        ),
        10.0,
    )?;
    layout.paragraph(
        &format!(
            "日期 / Date: {}    有效期 / Valid until: {}\n币种 / Currency: {}",
            fields.quoted_on, fields.valid_until, fields.currency
        ),
        10.0,
    )?;
    layout.paragraph("商品明细 / Quotation items", 13.0)?;
    for (index, line) in fields.lines.iter().enumerate() {
        // Keep the item heading and the first lines together when space permits.
        if layout.y < 150.0 {
            layout.y = 0.0;
        }
        layout.paragraph(
            &format!(
                "{:02}. {} | {}",
                index + 1,
                line.product.code,
                line.product.name
            ),
            11.0,
        )?;
        for parameter in &line.product.parameters {
            layout.paragraph(&format!("{}: {}", parameter.name, parameter.value), 9.5)?;
        }
        let moq = line.product.moq.as_deref().unwrap_or("未知 / Unknown");
        let lead = match (line.product.lead_days_min, line.product.lead_days_max) {
            (Some(min), Some(max)) => format!("{min}-{max} 天 / days after order confirmation"),
            _ => "未知 / Unknown".into(),
        };
        layout.paragraph(
            &format!(
                "单位 / Unit: {}    MOQ: {}\n交期 / Lead time: {}",
                line.product.unit, moq, lead
            ),
            9.5,
        )?;
        layout.paragraph(
            &format!(
                "数量 / Qty: {}    单价 / Unit price: {}\n行金额 / Amount: {} {}",
                line.quantity, line.unit_price, fields.currency, quote.line_amounts[index]
            ),
            10.0,
        )?;
        if quote.below_moq.contains(&index) {
            layout.paragraph("低于 MOQ，需确认 / Below MOQ, subject to confirmation", 9.0)?;
        }
        layout.y -= 10.0;
    }
    if layout.y < 200.0 {
        layout.y = 0.0;
    }
    layout.paragraph(
        &format!(
            "商品小计 / Subtotal: {} {}\n折扣 / Discount: {}\n税费 / Tax: {}\n运费 / Freight: {}",
            fields.currency, quote.subtotal, fields.discount, fields.tax, fields.freight
        ),
        10.0,
    )?;
    layout.paragraph(
        &format!("报价合计 / TOTAL: {} {}", fields.currency, quote.total),
        14.0,
    )?;
    layout.paragraph("约定条款 / Terms", 12.0)?;
    layout.paragraph(&fields.terms, 10.0)?;
    Ok(())
}

pub fn render(quote: &QuoteDocument) -> Result<Vec<u8>, String> {
    let face = ttf_parser::Face::parse(FONT, 0).map_err(|_| "内置报价字体无法读取。")?;
    let mut layout = Layout {
        face,
        pages: vec![vec![]],
        y: 742.0,
    };
    content(quote, &mut layout)?;
    let count = layout.pages.len();
    for (index, page) in layout.pages.iter_mut().enumerate() {
        page.push(TextLine {
            text: "报价单 / QUOTATION".into(),
            size: 18.0,
            x: 42.0,
            y: 793.0,
        });
        page.push(TextLine {
            text: format!("{}   |   TradeQuill", quote.number),
            size: 10.0,
            x: 42.0,
            y: 771.0,
        });
        page.push(TextLine {
            text: format!("{}   |   第 {} / {} 页", quote.number, index + 1, count),
            size: 8.5,
            x: 42.0,
            y: 30.0,
        });
    }
    let mut glyphs = BTreeMap::new();
    for page in &layout.pages {
        for line in page {
            for character in line.text.chars() {
                let glyph = layout
                    .face
                    .glyph_index(character)
                    .ok_or_else(|| format!("内置字体不支持「{character}」。"))?;
                glyphs.entry(glyph.0).or_insert(character);
            }
        }
    }
    let mut pdf = Pdf::new();
    let catalog = Ref::new(1);
    let tree = Ref::new(2);
    let font = Ref::new(3);
    let cid = Ref::new(4);
    let descriptor = Ref::new(5);
    let font_stream = Ref::new(6);
    let cmap_stream = Ref::new(7);
    let name = Name(b"TradeQuillSans");
    let system = SystemInfo {
        registry: Str(b"Adobe"),
        ordering: Str(b"Identity"),
        supplement: 0,
    };
    pdf.catalog(catalog).pages(tree);
    pdf.type0_font(font)
        .base_font(name)
        .encoding_predefined(Name(b"Identity-H"))
        .descendant_font(cid)
        .to_unicode(cmap_stream);
    let factor = 1000.0 / f32::from(layout.face.units_per_em());
    let mut cid_font = pdf.cid_font(cid);
    cid_font
        .subtype(CidFontType::Type2)
        .base_font(name)
        .system_info(system)
        .font_descriptor(descriptor)
        .default_width(1000.0)
        .cid_to_gid_map_predefined(Name(b"Identity"));
    {
        let mut widths = cid_font.widths();
        for glyph in glyphs.keys() {
            widths.consecutive(
                *glyph,
                [f32::from(
                    layout
                        .face
                        .glyph_hor_advance(ttf_parser::GlyphId(*glyph))
                        .unwrap_or(0),
                ) * factor],
            );
        }
    }
    cid_font.finish();
    let bbox = layout.face.global_bounding_box();
    pdf.font_descriptor(descriptor)
        .name(name)
        .flags(FontFlags::SYMBOLIC)
        .bbox(Rect::new(
            f32::from(bbox.x_min) * factor,
            f32::from(bbox.y_min) * factor,
            f32::from(bbox.x_max) * factor,
            f32::from(bbox.y_max) * factor,
        ))
        .italic_angle(0.0)
        .ascent(f32::from(layout.face.ascender()) * factor)
        .descent(f32::from(layout.face.descender()) * factor)
        .cap_height(
            f32::from(
                layout
                    .face
                    .capital_height()
                    .unwrap_or(layout.face.ascender()),
            ) * factor,
        )
        .stem_v(80.0)
        .font_file2(font_stream);
    let mut compressor = ZlibEncoder::new(Vec::new(), Compression::default());
    compressor
        .write_all(FONT)
        .map_err(|error| error.to_string())?;
    let compressed = compressor.finish().map_err(|error| error.to_string())?;
    pdf.stream(font_stream, &compressed)
        .filter(Filter::FlateDecode)
        .pair(Name(b"Length1"), FONT.len() as i32);
    let mut cmap = UnicodeCmap::new(Name(b"TradeQuill-Unicode"), system);
    for (glyph, character) in glyphs {
        cmap.pair(glyph, character);
    }
    pdf.stream(cmap_stream, &cmap.finish());
    let page_refs: Vec<_> = (0..count).map(|i| Ref::new(10 + i as i32 * 2)).collect();
    pdf.pages(tree)
        .kids(page_refs.iter().copied())
        .count(count as i32);
    for (index, lines) in layout.pages.iter().enumerate() {
        let stream = Ref::new(11 + index as i32 * 2);
        let mut page = pdf.page(page_refs[index]);
        page.media_box(Rect::new(0.0, 0.0, 595.0, 842.0))
            .parent(tree)
            .contents(stream);
        page.resources().fonts().pair(Name(b"F1"), font);
        page.finish();
        let mut drawing = Content::new();
        drawing.set_stroke_gray(0.75);
        drawing.set_line_width(0.6);
        drawing.move_to(42.0, 757.0).line_to(553.0, 757.0).stroke();
        drawing.set_fill_gray(0.1);
        for line in lines {
            let mut bytes = Vec::new();
            for character in line.text.chars() {
                let glyph = layout
                    .face
                    .glyph_index(character)
                    .ok_or("字体字符无法读取。")?;
                bytes.extend_from_slice(&glyph.0.to_be_bytes());
            }
            drawing
                .begin_text()
                .set_font(Name(b"F1"), line.size)
                .next_line(line.x, line.y)
                .show(Str(&bytes))
                .end_text();
        }
        pdf.stream(stream, &drawing.finish());
    }
    pdf.document_info(Ref::new(8))
        .title(TextStr(&quote.number))
        .creator(TextStr("TradeQuill"));
    Ok(pdf.finish())
}

pub fn save(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if !path
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
    {
        return Err("请使用 .pdf 文件扩展名。".into());
    }
    let parent = path.parent().ok_or("保存位置无效。")?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)
        .map_err(|error| format!("无法创建报价文件：{error}"))?;
    temporary
        .write_all(bytes)
        .and_then(|()| temporary.as_file().sync_all())
        .map_err(|error| format!("PDF 保存失败，原文件未更改：{error}"))?;
    temporary
        .persist(path)
        .map_err(|error| format!("无法保存 PDF，请检查保存位置后重试：{error}"))?;
    Ok(())
}
