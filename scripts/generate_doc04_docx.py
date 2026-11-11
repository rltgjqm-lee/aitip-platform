import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def create_doc04():
    doc = docx.Document()

    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_title = p_title.add_run('[DOC-04] Cloudflare D1 통합 데이터베이스 스키마 기본 설계서')
    run_title.font.name = '맑은 고딕'
    run_title.font.size = Pt(20)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_sub = p_sub.add_run('버전 1.1.0 (Production Verified Baseline) | 작성일: 2026-11-07')
    run_sub.font.name = '맑은 고딕'
    run_sub.font.size = Pt(10)
    run_sub.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

    doc.add_paragraph()

    with open('docs/DOC-04_Cloudflare_D1_통합데이터베이스_스키마_명세서.md', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    in_code = False
    code_lines = []

    def set_cell_background(cell, fill_hex):
        shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        cell._tc.get_or_add_tcPr().append(shading_elm)

    for line in lines[6:]:
        line_s = line.strip()

        if line_s.startswith('```'):
            if in_code:
                in_code = False
                table = doc.add_table(rows=1, cols=1)
                table.alignment = WD_TABLE_ALIGNMENT.CENTER
                cell = table.cell(0, 0)
                set_cell_background(cell, 'F1F5F9')
                cell.text = ''.join(code_lines)
                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(4)
                p.paragraph_format.space_after = Pt(4)
                if p.runs:
                    run = p.runs[0]
                    run.font.name = 'Consolas'
                    run.font.size = Pt(8.5)
                    run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
                code_lines = []
                doc.add_paragraph()
            else:
                in_code = True
                code_lines = []
            continue

        if in_code:
            code_lines.append(line)
            continue

        if not line_s:
            continue

        if line_s.startswith('## '):
            h = doc.add_paragraph()
            h.paragraph_format.space_before = Pt(14)
            h.paragraph_format.space_after = Pt(4)
            run = h.add_run(line_s[3:])
            run.font.name = '맑은 고딕'
            run.font.size = Pt(14)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
        elif line_s.startswith('### '):
            h = doc.add_paragraph()
            h.paragraph_format.space_before = Pt(10)
            h.paragraph_format.space_after = Pt(3)
            run = h.add_run(line_s[4:])
            run.font.name = '맑은 고딕'
            run.font.size = Pt(11)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
        elif line_s.startswith('* ') or line_s.startswith('- '):
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(1)
            run = p.add_run(line_s[2:])
            run.font.name = '맑은 고딕'
            run.font.size = Pt(9.5)
        else:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(line_s)
            run.font.name = '맑은 고딕'
            run.font.size = Pt(9.5)

    doc.save('docs/DOC-04_Cloudflare_D1_통합데이터베이스_스키마_명세서.docx')
    print('DOC-04 Word document created successfully!')

if __name__ == '__main__':
    create_doc04()
