import sys
import os
import json
import subprocess
import shutil

# Đảm bảo UTF-8 cho stdout/stderr trên Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

VIETNAMESE_VOWELS = set('àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ')

def count_accents(text):
    if not text:
        return 0
    t = text.lower()
    return sum(1 for ch in t if ch in VIETNAMESE_VOWELS)

def find_tesseract():
    paths = [
        r'D:\Tesseract\tesseract.exe',
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]
    for p in paths:
        if os.path.isfile(p):
            return p
    which = shutil.which('tesseract')
    if which:
        return which
    return None

def extract_with_pymupdf(pdf_path):
    import pymupdf

    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)
    page_texts = []
    total_accents = 0
    total_chars = 0

    for i in range(total_pages):
        page = doc[i]
        # Bóc text theo khối giữ nguyên cấu trúc
        t = page.get_text('text')
        acc = count_accents(t)
        total_accents += acc
        total_chars += len(t.strip())
        page_texts.append(t)

    full_text = '\n\n'.join(page_texts).strip()

    # Tỷ lệ dấu tiếng Việt trên tổng số ký tự
    accent_density = (total_accents / total_chars) if total_chars > 0 else 0

    # Nếu văn bản có text vector chuẩn tiếng Việt (tổng dấu > 30 và tỷ lệ dấu > 6%)
    if total_chars > 80 and total_accents > 25 and accent_density > 0.05:
        return {
            'success': True,
            'engine': 'pymupdf-text',
            'pages': total_pages,
            'accents': total_accents,
            'density': round(accent_density, 4),
            'text': full_text
        }

    # Nếu là PDF scan hoặc PDF có lớp OCR tiếng Anh bị rụng dấu (scanner ASCII layer)
    tess_path = find_tesseract()
    if not tess_path:
        # Nếu không có tesseract, trả về text thô trích xuất được
        return {
            'success': True,
            'engine': 'pymupdf-raw-fallback',
            'pages': total_pages,
            'accents': total_accents,
            'density': round(accent_density, 4),
            'text': full_text
        }

    # Dùng PyMuPDF render trang ra ảnh 220 DPI và chạy Tesseract OCR tiếng Việt
    ocr_pages = []
    # OCR tối đa 6 trang đầu + trang cuối (chứa chữ ký)
    pages_to_ocr = list(range(min(6, total_pages)))
    if total_pages > 6 and (total_pages - 1) not in pages_to_ocr:
        pages_to_ocr.append(total_pages - 1)

    for pno in pages_to_ocr:
        page = doc[pno]
        # 220 DPI cho độ nét chữ rất cao mà tốc độ xử lý nhanh gấp 2 lần 300 DPI
        pix = page.get_pixmap(dpi=220)
        tmp_img = os.path.join(os.path.dirname(pdf_path), f'tmp_pymupdf_ocr_{pno}_{os.getpid()}.png')
        pix.save(tmp_img)
        try:
            cmd = [tess_path, tmp_img, 'stdout', '-l', 'vie', '--psm', '6']
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40)
            text_p = res.stdout.decode('utf-8', errors='ignore')
            ocr_pages.append(text_p.strip())
        except Exception as e:
            ocr_pages.append(page_texts[pno] if pno < len(page_texts) else '')
        finally:
            if os.path.exists(tmp_img):
                try:
                    os.remove(tmp_img)
                except:
                    pass

    ocr_full = '\n\n'.join(ocr_pages).strip()
    return {
        'success': True,
        'engine': 'pymupdf-tesseract-vie',
        'pages': total_pages,
        'accents': count_accents(ocr_full),
        'text': ocr_full if len(ocr_full) > len(full_text) else full_text
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'Vui lòng cung cấp đường dẫn file PDF'}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.isfile(pdf_path):
        print(json.dumps({'success': False, 'error': f'Không tìm thấy file: {pdf_path}'}))
        sys.exit(1)

    try:
        res = extract_with_pymupdf(pdf_path)
        print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()

