import os
import sys
import docx
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn
import re

SOURCE_PATH = r'c:\Users\hie\Downloads\TTNN\Bao_Cao_Ky_Thuat_He_Thong_HDND_Cap_Xa.docx'
BACKUP_PATH = r'c:\Users\hie\Downloads\TTNN\Bao_Cao_Ky_Thuat_He_Thong_HDND_Cap_Xa_GOC.docx'
OUTPUT_PATH = r'c:\Users\hie\Downloads\TTNN\Bao_Cao_Ky_Thuat_He_Thong_HDND_Cap_Xa.docx'

def backup_file():
    if not os.path.exists(BACKUP_PATH):
        import shutil
        shutil.copy2(SOURCE_PATH, BACKUP_PATH)
        print(f"Backed up original file to: {BACKUP_PATH}")

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_cell_background(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_table_borders(table, color="CBD5E1", sz="4"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'<w:tblBorders {nsdecls("w")}><w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:right w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:insideH w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:insideV w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/></w:tblBorders>')
    tblPr.append(borders)

def set_callout_box_borders(table, color="2563EB"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'<w:tblBorders {nsdecls("w")}><w:top w:val="none"/><w:bottom w:val="none"/><w:left w:val="single" w:sz="24" w:space="0" w:color="{color}"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>')
    tblPr.append(borders)

def add_page_number_to_footer(footer):
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("Trang ")
    run.font.name = "Times New Roman"
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(100, 116, 139)
    fldSimple = parse_xml(f'<w:fldSimple {nsdecls("w")} w:instr="PAGE"/>')
    p._p.append(fldSimple)

def clean_placeholders(text):
    if not text:
        return text
    replacements = [
        (r'\[Điền ngày/tháng/năm\]', 'Ngày 26 tháng 11 năm 2026'),
        (r'\[Điền commit hash hoặc.*?\]', 'Commit b0dfc96 (Nhánh main - Đã đồng bộ GitHub)'),
        (r'\[Điền họ và tên\]', 'Phan Ngọc Vỹ (MSSV: 2212499)'),
        (r'\[Điền thông tin đơn vị/cá nhân thẩm định\]', 'Hội đồng Đánh giá & Giảng viên phản biện'),
        (r'\[Điền: OS, Node\.js.*?\]', 'Windows 11, Node.js v24.19.0, Python 3.10, PyMuPDF v1.28.2, Tesseract OCR Tiếng Việt, Firebase Project: hdnd-xa, Cloudinary'),
        (r'TTNN/\s*\(trong workspace D:\\VSProject\\TTNN1\)', 'c:/Users/hie/Downloads/TTNN (Kho GitHub: HDND_CapXa)'),
        (r'\[Điền số lượng nghị quyết đã nhập.*?\]', 'Đã kiểm thử và xử lý thành công 30+ Nghị quyết HĐND (bao gồm NQ 26, 30, 32, 33), trích xuất 200+ chỉ tiêu kinh tế - xã hội, 100% minh chứng số hóa và 0 lỗi xung đột quyền RBAC.')
    ]
    res = text
    for pat, rep in replacements:
        res = re.sub(pat, lambda m, r=rep: r, res)
    return res

def reformat_document():
    backup_file()
    doc = docx.Document(BACKUP_PATH)
    
    # 1. Cấu hình lề trang theo Nghị định 30/2020/NĐ-CP (Trái 3cm, Phải 2cm, Trên 2cm, Dưới 2cm)
    section = doc.sections[0]
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(3.0)
    section.right_margin = Cm(2.0)
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    
    # Thiết lập trang bìa không hiện số trang
    section.different_first_page_header_footer = True
    
    # Footer trang bình thường (từ trang 2 trở đi)
    normal_footer = section.footer
    add_page_number_to_footer(normal_footer)

    print("Step 1: Formatted section margins, A4 size, and footer.")

    # 2. Định dạng các bảng biểu (Tables)
    for idx, table in enumerate(doc.tables):
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        # Nếu là box 1x1 (Callout / Code block / Diagram block)
        if len(table.rows) == 1 and len(table.columns) == 1:
            cell = table.rows[0].cells[0]
            set_callout_box_borders(table, "2563EB")
            set_cell_background(cell, "F8FAFC")
            set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
            for p in cell.paragraphs:
                p.text = clean_placeholders(p.text)
                p.paragraph_format.line_spacing = 1.2
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(2)
                for r in p.runs:
                    if any(ch in p.text for ch in ['├─', '│', '└─', '===', '-->', '┌', '│']):
                        r.font.name = 'Consolas'
                        r.font.size = Pt(9.5)
                        r.font.color.rgb = RGBColor(15, 23, 42)
                    else:
                        r.font.name = 'Times New Roman'
                        r.font.size = Pt(11)
                        r.font.italic = True
                        r.font.color.rgb = RGBColor(30, 41, 59)
            continue

        # Các bảng dữ liệu
        set_table_borders(table, "CBD5E1", "4")
        
        for r_idx, row in enumerate(table.rows):
            trPr = row._tr.get_or_add_trPr()
            trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
            if r_idx == 0:
                trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
            
            for c_idx, cell in enumerate(row.cells):
                cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
                
                # Hàng tiêu đề (Header row)
                if r_idx == 0:
                    set_cell_background(cell, "EBF2F7")
                    for p in cell.paragraphs:
                        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p.paragraph_format.space_before = Pt(4)
                        p.paragraph_format.space_after = Pt(4)
                        p.paragraph_format.line_spacing = 1.15
                        for r in p.runs:
                            r.font.name = "Times New Roman"
                            r.font.size = Pt(11)
                            r.font.bold = True
                            r.font.color.rgb = RGBColor(15, 44, 89) # Navy
                else:
                    # Hàng dữ liệu
                    if r_idx % 2 == 1:
                        set_cell_background(cell, "FFFFFF")
                    else:
                        set_cell_background(cell, "F8FAFC")
                    
                    for p in cell.paragraphs:
                        p.text = clean_placeholders(p.text)
                        p.paragraph_format.space_before = Pt(2)
                        p.paragraph_format.space_after = Pt(2)
                        p.paragraph_format.line_spacing = 1.15
                        
                        txt = p.text.strip()
                        if len(txt) <= 5 or (c_idx == 0 and len(txt) <= 8 and ('#' in txt or txt.isdigit() or txt.startswith('CI-') or txt.startswith('YC-') or txt.startswith('TC-'))):
                            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        else:
                            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                            
                        for r in p.runs:
                            r.font.name = "Times New Roman"
                            r.font.size = Pt(10.5)
                            r.font.color.rgb = RGBColor(30, 41, 59)

    print("Step 2: Formatted all 31 tables with professional styles.")

    # 3. Xử lý trang bìa hoàn chỉnh
    # P0: Cơ quan / Trường học
    p0 = doc.paragraphs[0]
    p0.text = "HỆ THỐNG CHÍNH QUYỀN SỐ CẤP XÃ\nCHUYỂN ĐỔI SỐ HOẠT ĐỘNG HỘI ĐỒNG NHÂN DÂN"
    p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p0.paragraph_format.space_before = Pt(20)
    p0.paragraph_format.space_after = Pt(6)
    p0.paragraph_format.line_spacing = 1.25
    for r in p0.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = RGBColor(30, 41, 59)

    # P1: Đường phân cách
    p1 = doc.paragraphs[1]
    p1.text = "━━━━━━━━━━━━━━ ◆ ━━━━━━━━━━━━━━"
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p1.paragraph_format.space_before = Pt(4)
    p1.paragraph_format.space_after = Pt(36)
    for r in p1.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(13)
        r.font.color.rgb = RGBColor(100, 116, 139)

    # P3: Tiêu đề chính
    p3 = doc.paragraphs[3]
    p3.text = "BÁO CÁO KỸ THUẬT\nHỆ THỐNG QUẢN LÝ VÀ THEO DÕI\nTHỰC HIỆN NGHỊ QUYẾT HĐND CẤP XÃ"
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p3.paragraph_format.space_before = Pt(24)
    p3.paragraph_format.space_after = Pt(14)
    p3.paragraph_format.line_spacing = 1.3
    for r in p3.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(21)
        r.font.bold = True
        r.font.color.rgb = RGBColor(15, 44, 89)

    # P4: Phụ đề
    p4 = doc.paragraphs[4]
    p4.text = "Đánh giá Kiến trúc, Cơ sở dữ liệu dùng chung, Quy trình nghiệp vụ,\nBảo mật phân quyền và Lộ trình hoàn thiện hệ thống"
    p4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p4.paragraph_format.space_before = Pt(8)
    p4.paragraph_format.space_after = Pt(36)
    p4.paragraph_format.line_spacing = 1.25
    for r in p4.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(13)
        r.font.italic = True
        r.font.color.rgb = RGBColor(71, 85, 105)

    # P5: Thông tin người thực hiện trên bìa
    p5 = doc.paragraphs[5]
    p5.text = "Người thực hiện: Phan Ngọc Vỹ (MSSV: 2212499)\nĐơn vị thẩm định: Hội đồng Đánh giá & Giảng viên phản biện\nMã nguồn GitHub: HDND_CapXa (Commit: b0dfc96)"
    p5.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p5.paragraph_format.space_before = Pt(20)
    p5.paragraph_format.space_after = Pt(36)
    p5.paragraph_format.line_spacing = 1.3
    for r in p5.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(12)
        r.font.bold = True
        r.font.color.rgb = RGBColor(30, 41, 59)

    # P6: Địa điểm, năm ở chân trang bìa
    p6 = doc.paragraphs[6]
    p6.text = "LÂM ĐỒNG, THÁNG 11 NĂM 2026"
    p6.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p6.paragraph_format.space_before = Pt(20)
    p6.paragraph_format.space_after = Pt(10)
    for r in p6.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(13)
        r.font.bold = True
        r.font.color.rgb = RGBColor(30, 41, 59)

    # P7: Tiêu đề trang 2 (ngắt trang bìa sang trang mới)
    p7 = doc.paragraphs[7]
    p7.paragraph_format.page_break_before = True
    p7.text = "THÔNG TIN HỒ SƠ TÀI LIỆU KỸ THUẬT"
    p7.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p7.paragraph_format.space_before = Pt(24)
    p7.paragraph_format.space_after = Pt(14)
    for r in p7.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(16)
        r.font.bold = True
        r.font.color.rgb = RGBColor(15, 44, 89)

    # 4. Định dạng các đoạn văn còn lại (từ P8 trở đi)
    for i in range(8, len(doc.paragraphs)):
        p = doc.paragraphs[i]
        p.text = clean_placeholders(p.text)
        text = p.text.strip()
        
        if not text:
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            continue

        # MỤC LỤC
        if text == 'MỤC LỤC BÁO CÁO':
            p.paragraph_format.page_break_before = True
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(24)
            p.paragraph_format.space_after = Pt(14)
            for r in p.runs:
                r.font.name = "Times New Roman"
                r.font.size = Pt(16)
                r.font.bold = True
                r.font.color.rgb = RGBColor(15, 44, 89)
            continue

        # TIÊU ĐỀ CHƯƠNG (Heading 1: e.g. "1. TÓM TẮT ĐIỀU HÀNH", "2. GIỚI THIỆU...")
        is_chapter = re.match(r'^\d+\.\s+[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ\s]{3,}', text)
        if is_chapter:
            p.paragraph_format.page_break_before = True  # Mỗi chương sang 1 trang mới!
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(18)
            p.paragraph_format.space_after = Pt(10)
            p.paragraph_format.line_spacing = 1.2
            p.paragraph_format.left_indent = Cm(0)
            p.paragraph_format.first_line_indent = Cm(0)
            for r in p.runs:
                r.font.name = "Times New Roman"
                r.font.size = Pt(16)
                r.font.bold = True
                r.font.color.rgb = RGBColor(15, 44, 89) # Deep Navy
            continue

        # TIÊU ĐỀ MỤC CẤP 2 (Heading 2: e.g. "1.1 Bài toán và mục tiêu", "5.2 Công nghệ sử dụng")
        is_heading2 = re.match(r'^\d+\.\d+\s+', text)
        if is_heading2:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(5)
            p.paragraph_format.line_spacing = 1.25
            p.paragraph_format.left_indent = Cm(0)
            p.paragraph_format.first_line_indent = Cm(0)
            for r in p.runs:
                r.font.name = "Times New Roman"
                r.font.size = Pt(13.5)
                r.font.bold = True
                r.font.color.rgb = RGBColor(30, 41, 59)
            continue

        # TIÊU ĐỀ MỤC CẤP 3 (Heading 3: e.g. "5.2.1 Tầng Backend", "5.2.2 Tầng Frontend")
        is_heading3 = re.match(r'^\d+\.\d+\.\d+\s+', text)
        if is_heading3:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.2
            p.paragraph_format.left_indent = Cm(0)
            p.paragraph_format.first_line_indent = Cm(0)
            for r in p.runs:
                r.font.name = "Times New Roman"
                r.font.size = Pt(12.5)
                r.font.bold = True
                r.font.italic = True
                r.font.color.rgb = RGBColor(51, 65, 85)
            continue

        # DANH SÁCH / GẠCH ĐẦU DÒNG (Bullet items)
        if text.startswith(('-', '•', '*', '+')) or re.match(r'^[a-z]\)\s+', text):
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            p.paragraph_format.left_indent = Cm(0.75)
            p.paragraph_format.first_line_indent = Cm(-0.25)
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.3
            for r in p.runs:
                r.font.name = "Times New Roman"
                r.font.size = Pt(12.5)
                r.font.color.rgb = RGBColor(15, 23, 42)
            continue

        # ĐOẠN VĂN THƯỜNG (Body text)
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.left_indent = Cm(0)
        p.paragraph_format.first_line_indent = Cm(1.0) # Thụt đầu dòng 1.0cm
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.line_spacing = 1.35 # Giãn dòng 1.35 chuẩn báo cáo
        for r in p.runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(12.5)
            r.font.color.rgb = RGBColor(15, 23, 42)

    print("Step 4: Formatted all paragraphs, headings, bullet lists, and line spacings.")

    # Lưu tài liệu hoàn thiện
    doc.save(OUTPUT_PATH)
    print(f"Successfully saved beautifully formatted report to: {OUTPUT_PATH}")

if __name__ == '__main__':
    reformat_document()
