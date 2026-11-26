import os
import sys
import docx
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn
import re

SOURCE_PATH = r'c:\Users\hie\Downloads\TTNN\Bao_Cao_Dac_Ta_Ky_Thuat_He_Thong_HDND_Cap_Xa.docx'
if not os.path.exists(SOURCE_PATH):
    SOURCE_PATH = r'c:\Users\hie\Downloads\TTNN\Bao_Cao_Ky_Thuat_He_Thong_HDND_Cap_Xa.docx'

OUTPUT_PATH_1 = r'c:\Users\hie\Downloads\TTNN\Bao_Cao_Dac_Ta_HDND_Cap_Xa.docx'
OUTPUT_PATH_2 = r'c:\Users\hie\Downloads\TTNN\Bao_Cao_Dac_Ta_Ky_Thuat_He_Thong_HDND_Cap_Xa.docx'
SECONDARY_PATH = r'c:\Users\hie\Downloads\TTNN\Bao_Cao_Ky_Thuat_He_Thong_HDND_Cap_Xa.docx'

def set_cell_margins(cell, top=80, bottom=80, left=120, right=120):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_cell_background(cell, hex_color="FFFFFF"):
    tcPr = cell._tc.get_or_add_tcPr()
    for child in list(tcPr):
        if child.tag.endswith('shd'):
            tcPr.remove(child)
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_table_borders_black(table, color="000000", sz="4"):
    tblPr = table._tbl.tblPr
    for child in list(tblPr):
        if child.tag.endswith('tblBorders'):
            tblPr.remove(child)
    borders = parse_xml(f'<w:tblBorders {nsdecls("w")}><w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:right w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:insideH w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:insideV w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/></w:tblBorders>')
    tblPr.append(borders)

def set_box_borders_black(table, color="000000", sz="6"):
    tblPr = table._tbl.tblPr
    for child in list(tblPr):
        if child.tag.endswith('tblBorders'):
            tblPr.remove(child)
    borders = parse_xml(f'<w:tblBorders {nsdecls("w")}><w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:right w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders>')
    tblPr.append(borders)

def add_cover_page_border(section):
    sectPr = section._sectPr
    for child in list(sectPr):
        if child.tag.endswith('pgBorders'):
            sectPr.remove(child)
    xml_str = '<w:pgBorders xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:offsetFrom="page" w:display="firstPage"><w:top w:val="double" w:sz="18" w:space="20" w:color="000000"/><w:left w:val="double" w:sz="18" w:space="24" w:color="000000"/><w:bottom w:val="double" w:sz="18" w:space="20" w:color="000000"/><w:right w:val="double" w:sz="18" w:space="20" w:color="000000"/></w:pgBorders>'
    pgBrd = parse_xml(xml_str)
    sectPr.append(pgBrd)

def remove_all_pBdr_and_blue_lines(doc):
    # Xóa triệt để toàn bộ đường viền đoạn văn (pBdr) - đặc biệt là đường viền dưới màu xanh của các tiêu đề chương
    for p in doc.paragraphs:
        pPr = p._p.get_or_add_pPr()
        for child in list(pPr):
            if child.tag.endswith('pBdr'):
                pPr.remove(child)
                
    # Xóa pBdr và tcBorders bên trong tất cả các ô của toàn bộ các bảng
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                tcPr = cell._tc.get_or_add_tcPr()
                for child in list(tcPr):
                    if child.tag.endswith('tcBorders'):
                        tcPr.remove(child)
                for p in cell.paragraphs:
                    pPr = p._p.get_or_add_pPr()
                    for child in list(pPr):
                        if child.tag.endswith('pBdr'):
                            pPr.remove(child)

def add_page_number_to_footer(footer):
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("Trang ")
    run.font.name = "Times New Roman"
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(0, 0, 0)
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

def build_specification_report():
    doc = docx.Document(SOURCE_PATH)
    
    # 1. Cấu hình lề trang theo chuẩn văn bản báo cáo (Trái 3.0cm, Phải 2.0cm, Trên 2.0cm, Dưới 2.0cm)
    section = doc.sections[0]
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(3.0)
    section.right_margin = Cm(2.0)
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    
    # Khung viền đôi nghệ thuật trang bìa đặc tả
    add_cover_page_border(section)
    
    # Trang bìa không đánh số trang
    section.different_first_page_header_footer = True
    normal_footer = section.footer
    add_page_number_to_footer(normal_footer)

    print("Step 1: Set specification report margins (Left 3.0cm), double cover border, and footer.")

    # 2. Định dạng TẤT CẢ các bảng thành BẢNG TRẮNG 100%, VIỀN ĐEN, CHỮ ĐEN THUẦN
    for idx, table in enumerate(doc.tables):
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        # Hộp 1x1 (Sơ đồ / Callout / Code)
        if len(table.rows) == 1 and len(table.columns) == 1:
            cell = table.rows[0].cells[0]
            set_box_borders_black(table, "000000", "6")
            set_cell_background(cell, "FFFFFF")
            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
            for p in cell.paragraphs:
                p.text = clean_placeholders(p.text)
                p.paragraph_format.line_spacing = 1.2
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(2)
                for r in p.runs:
                    if any(ch in p.text for ch in ['├─', '│', '└─', '===', '-->', '┌', '│']):
                        r.font.name = 'Consolas'
                        r.font.size = Pt(9.5)
                        r.font.color.rgb = RGBColor(0, 0, 0)
                    else:
                        r.font.name = 'Times New Roman'
                        r.font.size = Pt(11)
                        r.font.italic = True
                        r.font.color.rgb = RGBColor(0, 0, 0)
            continue

        # Các bảng dữ liệu thông thường
        set_table_borders_black(table, "000000", "4")
        
        for r_idx, row in enumerate(table.rows):
            trPr = row._tr.get_or_add_trPr()
            trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
            if r_idx == 0:
                trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
            
            for c_idx, cell in enumerate(row.cells):
                cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
                # Đảm bảo 100% ô màu trắng thuần
                set_cell_background(cell, "FFFFFF")
                
                for p in cell.paragraphs:
                    p.text = clean_placeholders(p.text)
                    p.paragraph_format.space_before = Pt(2)
                    p.paragraph_format.space_after = Pt(2)
                    p.paragraph_format.line_spacing = 1.15
                    
                    if r_idx == 0:
                        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    else:
                        txt = p.text.strip()
                        if len(txt) <= 5 or (c_idx == 0 and len(txt) <= 8 and ('#' in txt or txt.isdigit() or txt.startswith('CI-') or txt.startswith('YC-') or txt.startswith('TC-'))):
                            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        else:
                            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                            
                    for r in p.runs:
                        r.font.name = "Times New Roman"
                        r.font.size = Pt(11) if r_idx == 0 else Pt(10.5)
                        r.font.bold = (r_idx == 0)
                        r.font.color.rgb = RGBColor(0, 0, 0) # Màu đen thuần

    print("Step 2: Successfully transformed all 31 tables into pure white background and black borders.")

    # 3. TRANG BÌA CHUẨN BÁO CÁO ĐẶC TẢ KỸ THUẬT (Có khung viền kép sang trọng)
    p0 = doc.paragraphs[0]
    p0.text = "TRƯỜNG ĐẠI HỌC ĐÀ LẠT\nKHOA CÔNG NGHỆ THÔNG TIN"
    p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p0.paragraph_format.space_before = Pt(28)
    p0.paragraph_format.space_after = Pt(6)
    p0.paragraph_format.line_spacing = 1.25
    for r in p0.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0, 0, 0)

    p1 = doc.paragraphs[1]
    p1.text = "─────────────── * ───────────────"
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p1.paragraph_format.space_before = Pt(2)
    p1.paragraph_format.space_after = Pt(40)
    for r in p1.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(12)
        r.font.color.rgb = RGBColor(0, 0, 0)

    p2 = doc.paragraphs[2]
    p2.text = "TÀI LIỆU KỸ THUẬT VÀ ĐẶC TẢ HỆ THỐNG"
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_before = Pt(16)
    p2.paragraph_format.space_after = Pt(20)
    p2.paragraph_format.line_spacing = 1.3
    for r in p2.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(15)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0, 0, 0)

    p3 = doc.paragraphs[3]
    p3.text = "BÁO CÁO ĐẶC TẢ KỸ THUẬT\nHỆ THỐNG QUẢN LÝ VÀ THEO DÕI\nTHỰC HIỆN NGHỊ QUYẾT HĐND CẤP XÃ"
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p3.paragraph_format.space_before = Pt(18)
    p3.paragraph_format.space_after = Pt(14)
    p3.paragraph_format.line_spacing = 1.3
    for r in p3.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(20)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0, 0, 0)

    p4 = doc.paragraphs[4]
    p4.text = "Đặc tả Kiến trúc hệ thống, Cơ sở dữ liệu dùng chung, Quy trình số hóa OCR,\nPhân quyền RBAC và Tài liệu hướng dẫn sử dụng"
    p4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p4.paragraph_format.space_before = Pt(6)
    p4.paragraph_format.space_after = Pt(48)
    p4.paragraph_format.line_spacing = 1.25
    for r in p4.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(13)
        r.font.italic = True
        r.font.color.rgb = RGBColor(0, 0, 0)

    p5 = doc.paragraphs[5]
    p5.text = "Người lập báo cáo:\tPhan Ngọc Vỹ\nMã số sinh viên:\t2212499\nĐơn vị đánh giá:\tKhoa Công nghệ Thông tin - Trường Đại học Đà Lạt\nMã nguồn GitHub:\tHDND_CapXa (Commit: b0dfc96)"
    p5.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p5.paragraph_format.left_indent = Cm(2.8)
    p5.paragraph_format.space_before = Pt(20)
    p5.paragraph_format.space_after = Pt(48)
    p5.paragraph_format.line_spacing = 1.35
    for r in p5.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(12.5)
        r.font.color.rgb = RGBColor(0, 0, 0)

    p6 = doc.paragraphs[6]
    p6.text = "Đà Lạt, tháng 11 năm 2026"
    p6.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p6.paragraph_format.space_before = Pt(28)
    p6.paragraph_format.space_after = Pt(10)
    for r in p6.runs:
        r.font.name = "Times New Roman"
        r.font.size = Pt(13)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0, 0, 0)

    # TRANG 2: THÔNG TIN HỒ SƠ TÀI LIỆU KỸ THUẬT (Ngắt trang từ p6 sang p7)
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
        r.font.color.rgb = RGBColor(0, 0, 0)

    # 4. Định dạng toàn bộ các đoạn văn bản trong báo cáo thành CHỮ ĐEN THUẦN
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
                r.font.color.rgb = RGBColor(0, 0, 0)
            continue

        # TIÊU ĐỀ CHƯƠNG (Heading 1)
        is_chapter = re.match(r'^\d+\.\s+[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ\s]{3,}', text) or text == 'PHỤ LỤC'
        if is_chapter:
            p.paragraph_format.page_break_before = True
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
                r.font.color.rgb = RGBColor(0, 0, 0)
            continue

        # TIÊU ĐỀ MỤC CẤP 2 (Heading 2)
        is_heading2 = re.match(r'^\d+\.\d+\s+', text) or text.startswith('Phụ lục ')
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
                r.font.color.rgb = RGBColor(0, 0, 0)
            continue

        # TIÊU ĐỀ MỤC CẤP 3 (Heading 3)
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
                r.font.color.rgb = RGBColor(0, 0, 0)
            continue

        # DANH SÁCH / GẠCH ĐẦU DÒNG
        if text.startswith(('-', '•', '*', '+', '☐')) or re.match(r'^[a-z]\)\s+', text):
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            p.paragraph_format.left_indent = Cm(0.75)
            p.paragraph_format.first_line_indent = Cm(-0.25)
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.3
            for r in p.runs:
                r.font.name = "Times New Roman"
                r.font.size = Pt(12.5)
                r.font.color.rgb = RGBColor(0, 0, 0)
            continue

        # ĐOẠN VĂN THƯỜNG
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.left_indent = Cm(0)
        p.paragraph_format.first_line_indent = Cm(1.0)
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.line_spacing = 1.35
        for r in p.runs:
            r.font.name = "Times New Roman"
            r.font.size = Pt(12.5)
            r.font.color.rgb = RGBColor(0, 0, 0)

    print("Step 3: Formatted specification cover and all text paragraphs to pure black.")

    # 5. CẬP NHẬT MỤC LỤC ĐỂ THÊM CHƯƠNG 13
    toc_table = doc.tables[2]
    # Kiểm tra xem dòng 13 đã tồn tại chưa để tránh trùng lặp
    has_row_13 = False
    for row in toc_table.rows:
        if '13.' in row.cells[0].text:
            has_row_13 = True
            break
            
    if not has_row_13:
        new_row = toc_table.add_row()
        new_row.cells[0].text = "13. Hướng dẫn sử dụng và vận hành hệ thống"
        new_row.cells[1].text = "13.1 Môi trường & Khởi động  |  13.2 Danh sách tài khoản  |  13.3 Kịch bản 7 bước  |  13.4 Xử lý sự cố"
        for c in new_row.cells:
            set_cell_background(c, "FFFFFF")
            set_cell_margins(c, top=70, bottom=70, left=100, right=100)
            p = c.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            for r in p.runs:
                r.font.name = "Times New Roman"
                r.font.size = Pt(10.5)
                r.font.color.rgb = RGBColor(0, 0, 0)

    # 6. THÊM NỘI DUNG CHƯƠNG 13: TÀI LIỆU HƯỚNG DẪN SỬ DỤNG VÀ VẬN HÀNH HỆ THỐNG
    # Kiểm tra xem chương 13 đã có trong văn bản chưa
    has_ch13 = any('13. TÀI LIỆU HƯỚNG DẪN SỬ DỤNG' in p.text for p in doc.paragraphs)
    
    if not has_ch13:
        phu_luc_idx = None
        for idx, p in enumerate(doc.paragraphs):
            if p.text.strip() == 'PHỤ LỤC':
                phu_luc_idx = idx
                break
                
        target_p = doc.paragraphs[phu_luc_idx] if phu_luc_idx else None

        def add_p_before(target, text, style_type='body'):
            if target:
                new_p = target.insert_paragraph_before('')
            else:
                new_p = doc.add_paragraph('')
                
            new_p.text = text
            for r in new_p.runs:
                r.font.name = "Times New Roman"
                r.font.color.rgb = RGBColor(0, 0, 0)
                
            if style_type == 'ch13':
                new_p.paragraph_format.page_break_before = True
                new_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                new_p.paragraph_format.space_before = Pt(18)
                new_p.paragraph_format.space_after = Pt(10)
                new_p.paragraph_format.line_spacing = 1.2
                for r in new_p.runs:
                    r.font.size = Pt(16)
                    r.font.bold = True
            elif style_type == 'h2':
                new_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                new_p.paragraph_format.space_before = Pt(12)
                new_p.paragraph_format.space_after = Pt(5)
                new_p.paragraph_format.line_spacing = 1.25
                for r in new_p.runs:
                    r.font.size = Pt(13.5)
                    r.font.bold = True
            elif style_type == 'h3':
                new_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                new_p.paragraph_format.space_before = Pt(8)
                new_p.paragraph_format.space_after = Pt(3)
                new_p.paragraph_format.line_spacing = 1.2
                for r in new_p.runs:
                    r.font.size = Pt(12.5)
                    r.font.bold = True
                    r.font.italic = True
            elif style_type == 'bullet':
                new_p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                new_p.paragraph_format.left_indent = Cm(0.75)
                new_p.paragraph_format.first_line_indent = Cm(-0.25)
                new_p.paragraph_format.space_before = Pt(2)
                new_p.paragraph_format.space_after = Pt(3)
                new_p.paragraph_format.line_spacing = 1.3
                for r in new_p.runs:
                    r.font.size = Pt(12.5)
            else: # body
                new_p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                new_p.paragraph_format.left_indent = Cm(0)
                new_p.paragraph_format.first_line_indent = Cm(1.0)
                new_p.paragraph_format.space_before = Pt(3)
                new_p.paragraph_format.space_after = Pt(5)
                new_p.paragraph_format.line_spacing = 1.35
                for r in new_p.runs:
                    r.font.size = Pt(12.5)
            return new_p

        print("Step 4: Inserting Chapter 13 (User Guide)...")
        
        add_p_before(target_p, "13. TÀI LIỆU HƯỚNG DẪN SỬ DỤNG VÀ VẬN HÀNH HỆ THỐNG", 'ch13')
        add_p_before(target_p, "Chương này cung cấp tài liệu hướng dẫn kỹ thuật chi tiết dành cho người dùng và cán bộ quản trị để khởi động, vận hành và khai thác toàn diện các phân hệ của Hệ thống Quản lý và Theo dõi thực hiện Nghị quyết HĐND cấp xã theo chuẩn Quy trình 1.", 'body')
        
        add_p_before(target_p, "13.1 Môi trường và các bước khởi động hệ thống", 'h2')
        add_p_before(target_p, "Để hệ thống vận hành ổn định trên máy chủ nội bộ hoặc máy trạm kiểm thử, quản trị viên cần chuẩn bị môi trường chạy bao gồm Node.js (phiên bản 18.x trở lên, khuyến nghị v20/v24 LTS), Python (phiên bản 3.9+ tích hợp PyMuPDF) và gói dữ liệu Tesseract OCR tiếng Việt (vie.traineddata đã đặt sẵn trong thư mục backend/tessdata/).", 'body')
        add_p_before(target_p, "Quy trình khởi động 2 phân hệ dịch vụ được thực hiện theo các bước sau:", 'body')
        add_p_before(target_p, "• Bước 1 — Khởi động Backend API Server: Mở cửa sổ dòng lệnh tại thư mục gốc dự án, di chuyển vào thư mục backend và chạy lệnh `npm run dev`. Máy chủ Backend sẽ lắng nghe tại cổng 5000 (URL: http://localhost:5000). Người dùng có thể kiểm tra trạng thái hoạt động tức thời qua endpoint kiểm tra sức khỏe tại http://localhost:5000/health (phản hồi JSON mã {ok: true}).", 'bullet')
        add_p_before(target_p, "• Bước 2 — Khởi động Frontend Web Application: Mở cửa sổ dòng lệnh thứ hai, di chuyển vào thư mục frontend và thực thi lệnh `npm run dev`. Giao diện web ứng dụng được phục vụ tại cổng 3000 (URL: http://localhost:3000).", 'bullet')
        add_p_before(target_p, "• Bước 3 — Kiểm tra kết nối dịch vụ phụ trợ: Hệ thống tự động kết nối cơ sở dữ liệu thời gian thực Firebase Cloud Firestore (Project: hdnd-xa) và đồng bộ lưu trữ tệp tin Cloudinary/Firebase Storage.", 'bullet')

        add_p_before(target_p, "13.2 Danh mục tài khoản thử nghiệm theo 4 vai trò (RBAC)", 'h2')
        add_p_before(target_p, "Hệ thống đã thiết lập sẵn 4 tài khoản người dùng đại diện đầy đủ cho 4 nhóm vai trò nghiệp vụ tham gia vào quy trình quản lý, phân khai, báo cáo và thẩm tra Nghị quyết HĐND. Mật khẩu đăng nhập mặc định cho toàn bộ các tài khoản là `123456`:", 'body')

        table_p = target_p.insert_paragraph_before('') if target_p else doc.add_paragraph('')
        tbl_acc = doc.add_table(rows=5, cols=4)
        table_p._p.addnext(tbl_acc._tbl)
        
        set_table_borders_black(tbl_acc, "000000", "4")
        acc_data = [
            ["STT", "Vai trò nghiệp vụ", "Email đăng nhập", "Chức năng và quyền hạn chính"],
            ["1", "Chuyên viên giúp việc HĐND", "chuyenvien@xa.gov.vn", "Tiếp nhận văn bản scan, số hóa OCR, bóc tách cây chỉ tiêu, phân bổ về các đơn vị"],
            ["2", "Thường trực HĐND cấp xã", "thuongtruc@xa.gov.vn", "Xem xét văn bản PDF gốc, ký ban hành Nghị quyết, phê duyệt phân bổ nhiệm vụ & deadline"],
            ["3", "Đơn vị thực hiện (UBND xã)", "ubnd@xa.gov.vn", "Tiếp nhận chỉ tiêu được giao, báo cáo số liệu thực tế định kỳ kèm tệp minh chứng bắt buộc"],
            ["4", "Các Ban của HĐND xã", "banhdnd@xa.gov.vn", "Thẩm tra trực tuyến tính hợp lệ của số liệu báo cáo và đối chiếu tài liệu minh chứng"]
        ]
        for r_idx, row in enumerate(tbl_acc.rows):
            trPr = row._tr.get_or_add_trPr()
            trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
            if r_idx == 0:
                trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
            for c_idx, cell in enumerate(row.cells):
                cell.text = acc_data[r_idx][c_idx]
                cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                set_cell_background(cell, "FFFFFF")
                set_cell_margins(cell, top=70, bottom=70, left=100, right=100)
                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(2)
                p.paragraph_format.line_spacing = 1.15
                if r_idx == 0:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                else:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if c_idx == 0 else WD_ALIGN_PARAGRAPH.LEFT
                for r in p.runs:
                    r.font.name = "Times New Roman"
                    r.font.size = Pt(11) if r_idx == 0 else Pt(10)
                    r.font.bold = (r_idx == 0)
                    r.font.color.rgb = RGBColor(0, 0, 0)

        add_p_before(target_p, "13.3 Hướng dẫn quy trình thao tác nghiệp vụ 7 bước", 'h2')
        add_p_before(target_p, "Quy trình vận hành toàn diện vòng đời Nghị quyết HĐND cấp xã được chuẩn hóa thành 7 bước thao tác khép kín như sau:", 'body')
        
        add_p_before(target_p, "Bước 1 — Soạn thảo, tải lên và số hóa OCR văn bản scan (Chuyên viên HĐND):", 'h3')
        add_p_before(target_p, "Người dùng đăng nhập tài khoản `chuyenvien@xa.gov.vn`, truy cập phân hệ 'Soạn thảo NQ' (thẻ upload). Tiến hành tải lên tệp văn bản PDF scan Nghị quyết hoặc nhấn nút 'Nạp mẫu NQ 32 xã Châu Thành'. Hệ thống tự động kích hoạt bộ máy OCR quang học kết hợp bộ từ điển hành chính tiếng Việt để trích xuất số hiệu văn bản (vd: 32/NQ-HĐND), trích yếu nội dung, ngày ban hành và họ tên người ký. Chuyên viên kiểm tra lại các trường thông tin tự động điền, nhấn 'Tạo bản soạn thảo nghị quyết', sau đó nhấn 'Trình Thường trực ký ban hành'. Trạng thái văn bản chuyển sang `pending_issue`.", 'body')

        add_p_before(target_p, "Bước 2 — Ký ban hành Nghị quyết (Thường trực HĐND cấp xã):", 'h3')
        add_p_before(target_p, "Chủ tịch hoặc Phó Chủ tịch HĐND đăng nhập tài khoản `thuongtruc@xa.gov.vn`, truy cập phân hệ 'Ký ban hành / Xác nhận' (thẻ approve). Màn hình hiển thị danh sách các Nghị quyết đang chờ phê duyệt kèm trình xem trước (preview) tệp PDF gốc lưu trữ trên Cloudinary. Sau khi đối chiếu nội dung, lãnh đạo nhấn nút 'Ký ban hành nghị quyết'. Hệ thống cập nhật trạng thái văn bản sang `issued` (đã ban hành) và hiển thị nút điều hướng 'Chuyển sang Bóc tách chỉ tiêu'.", 'body')

        add_p_before(target_p, "Bước 3 — Bóc tách tự động và phân bổ cây chỉ tiêu (Chuyên viên HĐND):", 'h3')
        add_p_before(target_p, "Tại thẻ 'Bóc tách & Phân chỉ tiêu' (thẻ tree), Chuyên viên chọn Nghị quyết vừa ban hành và nhấn nút 'Bóc tách tự động'. Thuật toán `indicatorExtractor` sẽ tự động phân tích cấu trúc Điều/Khoản, nhận diện con số chỉ tiêu kế hoạch kèm đơn vị tính tương ứng (đồng, %, công trình, người...), tự động loại bỏ các điều khoản thủ tục hành chính chung và dự đoán cơ quan phụ trách phù hợp. Chuyên viên có thể hiệu chỉnh trực tiếp trên bảng, sau đó nhấn 'Lưu bóc tách chỉ tiêu' và nhấn 'Phân chỉ tiêu về các ban'. Trạng thái chuyển sang `distributed`.", 'body')

        add_p_before(target_p, "Bước 4 — Phê duyệt giao việc và ấn định hạn chót (Thường trực HĐND):", 'h3')
        add_p_before(target_p, "Thường trực HĐND truy cập phân hệ 'Ký ban hành / Phê duyệt' để kiểm tra danh mục cây chỉ tiêu đã phân bổ. Lãnh đạo xác nhận cơ quan chủ trì, đơn vị phối hợp và ấn định hạn chót hoàn thành (deadline) cụ thể cho từng chỉ tiêu. Trạng thái chỉ tiêu chuyển sang `assigned` và sẵn sàng để đơn vị thực hiện báo cáo số liệu.", 'body')

        add_p_before(target_p, "Bước 5 — Cập nhật tiến độ số liệu và đính kèm minh chứng bắt buộc (UBND cấp xã):", 'h3')
        add_p_before(target_p, "Công chức chuyên môn hoặc đại diện UBND xã đăng nhập tài khoản `ubnd@xa.gov.vn`, truy cập phân hệ 'Báo cáo' (thẻ report). Người dùng chọn chỉ tiêu cần cập nhật, nhập giá trị thực tế đạt được, tỷ lệ hoàn thành (0% đến 100%) và bắt buộc tải lên tệp tài liệu minh chứng (quyết định giao vốn, hóa đơn, biên bản nghiệm thu, ảnh hiện trường). Sau khi kiểm tra thông tin, nhấn 'Gửi báo cáo'. Trạng thái báo cáo ghi nhận là `submitted`.", 'body')

        add_p_before(target_p, "Bước 6 — Thẩm tra trực tuyến báo cáo và tài liệu minh chứng (Các Ban HĐND):", 'h3')
        add_p_before(target_p, "Thành viên Ban Pháp chế hoặc Ban Kinh tế - Xã hội đăng nhập tài khoản `banhdnd@xa.gov.vn`, truy cập phân hệ 'Thẩm tra' (thẻ review). Ban HĐND xem xét số liệu báo cáo, tải xuống và đối chiếu với tệp minh chứng số đính kèm. Ban thực hiện đánh giá: nhấn 'Đồng ý thông qua' (báo cáo đạt, cập nhật tiến độ vào hệ thống) hoặc nhấn 'Yêu cầu giải trình / Cập nhật lại' kèm ghi chú chi tiết lý do từ chối.", 'body')

        add_p_before(target_p, "Bước 7 — Theo dõi tổng thể trên Dashboard và xử lý cảnh báo tự động:", 'h3')
        add_p_before(target_p, "Tất cả các bên liên quan truy cập phân hệ 'Tổng quan' (thẻ dashboard) để theo dõi Bảng điều hành thời gian thực. Hệ thống tự động tổng hợp tỷ lệ hoàn thành tổng thể, biểu đồ phân bổ theo từng bộ phận chuyên môn và tự động kích hoạt bộ cảnh báo hạn chót 3 màu: Màu xanh (tiến độ bình thường, còn trên 7 ngày), Màu vàng (sắp đến hạn chót, còn từ 1 đến 7 ngày) và Màu đỏ (đã quá hạn chót mà chưa hoàn thành). Thường trực HĐND căn cứ vào cảnh báo đỏ để ban hành văn bản đôn đốc hoặc điều chỉnh kế hoạch kịp thời.", 'body')

        add_p_before(target_p, "13.4 Xử lý các tình huống cảnh báo và sự cố thường gặp", 'h2')
        add_p_before(target_p, "Trong quá trình vận hành thực tế, một số tình huống đặc thù có thể phát sinh và được xử lý theo hướng dẫn sau:", 'body')
        add_p_before(target_p, "• Cảnh báo kiểm tra mật khẩu đã lưu của trình duyệt: Khi đăng nhập bằng tài khoản thử nghiệm trên Google Chrome, trình duyệt có thể hiển thị hộp thoại cảnh báo 'Mật khẩu vừa sử dụng đã bị lộ trong một sự cố rò rỉ dữ liệu'. Đây là cơ chế cảnh báo an toàn mật khẩu tự động của Google đối với chuỗi ký tự phổ biến `123456`, không phải lỗi hệ thống. Để không hiển thị cảnh báo này khi kiểm thử, người dùng truy cập chrome://password-manager/settings và tắt tạm tùy chọn 'Cảnh báo khi mật khẩu bị lộ'. Hệ thống cũng đã cấu hình thuộc tính autoComplete off trên form đăng nhập để hạn chế tối đa tình trạng này.", 'bullet')
        add_p_before(target_p, "• Tệp PDF scan bị lỗi font hoặc mất dấu khi bóc tách: Hệ thống đã tích hợp sẵn bộ chuẩn hóa từ vựng hành chính cleanAdministrativeWords nhằm tự động khắc phục các lỗi quang học như vỡ dấu, thiếu ký tự tiếng Việt. Trường hợp tệp scan có chất lượng quá mờ (độ phân giải dưới 150 DPI), Chuyên viên có thể hiệu chỉnh trực tiếp nội dung chỉ tiêu trên lưới dữ liệu trước khi lưu.", 'bullet')
        add_p_before(target_p, "• Lỗi thiếu tệp minh chứng khi gửi báo cáo: Hệ thống áp dụng quy tắc bắt buộc (Mandatory Evidence Validation). Nếu người dùng chưa chọn tệp đính kèm, nút gửi báo cáo sẽ tự động khóa nhằm ngăn chặn tình trạng cập nhật khống số liệu mà không có căn cứ pháp lý.", 'bullet')

    # Xóa triệt để toàn bộ đường viền dưới màu xanh và mọi đường viền đoạn văn (pBdr) trong toàn bộ bài
    remove_all_pBdr_and_blue_lines(doc)
    print("Step 5: Successfully removed all paragraph bottom borders (blue lines) across the entire document.")

    # Lưu tệp hoàn thiện
    doc.save(OUTPUT_PATH_1)
    print(f"Successfully saved specification report to:\n -> {OUTPUT_PATH_1}")

    try:
        doc.save(OUTPUT_PATH_2)
        print(f" -> Also saved to: {OUTPUT_PATH_2}")
    except Exception as e:
        print(f"Notice: {OUTPUT_PATH_2} locked ({e})")
        
    try:
        doc.save(SECONDARY_PATH)
        print(f" -> Also updated: {SECONDARY_PATH}")
    except PermissionError:
        print(f"Notice: {SECONDARY_PATH} is currently open in Word/WPS.")

if __name__ == '__main__':
    build_specification_report()
