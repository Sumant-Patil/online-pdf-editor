# convert_html_to_pdf.py
import sys
import os
import subprocess

def weasyprint_available():
    try:
        subprocess.run(
            ["python3", "-m", "weasyprint", "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        return True
    except Exception:
        return False

def convert_with_weasyprint(html_in, pdf_out):
    from weasyprint import HTML
    HTML(html_in).write_pdf(pdf_out)
    print("success (weasyprint)")

def convert_with_reportlab(html_in, pdf_out):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from bs4 import BeautifulSoup

    with open(html_in, "r", encoding="utf-8") as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, "html.parser")
    text = soup.get_text()

    c = canvas.Canvas(pdf_out, pagesize=letter)
    width, height = letter
    y = height - 50

    for line in text.split("\n"):
        if y < 50:
            c.showPage()
            y = height - 50
        c.drawString(50, y, line[:110])
        y -= 15

    c.save()
    print("success (reportlab fallback)")

def main():
    if len(sys.argv) < 3:
        print("usage: convert_html_to_pdf.py input.html output.pdf")
        sys.exit(1)

    html_in = sys.argv[1]
    pdf_out = sys.argv[2]

    try:
        if weasyprint_available():
            convert_with_weasyprint(html_in, pdf_out)
        else:
            convert_with_reportlab(html_in, pdf_out)
    except Exception as e:
        print("error:", e)
        sys.exit(2)

if __name__ == "__main__":
    main()
