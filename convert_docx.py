import sys
from docx import Document
from fpdf import FPDF

docx_path = sys.argv[1]
pdf_path = sys.argv[2]

try:
    doc = Document(docx_path)
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font("Arial", size=12)

    for para in doc.paragraphs:
        pdf.multi_cell(0, 10, para.text)

    pdf.output(pdf_path)
    print("success")
except Exception as e:
    print(f"error: {e}")
