// server.js (CommonJS)
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // receive edited HTML

const FRONTEND_DIR = path.join(__dirname, "frontend");
app.use(express.static(FRONTEND_DIR));

// ensure folders
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("converted")) fs.mkdirSync("converted");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ------ 1) Upload PDF -> Convert to DOCX ------
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No file uploaded.");

    const pdfPath = req.file.path;
    const docxName = req.file.filename.replace(/\.pdf$/i, ".docx");
    const docxPath = path.join("converted", docxName);

    console.log("Converting:", pdfPath, "→", docxPath);

    // Increase maxBuffer to allow large output from python
    exec(`python3 convert_pdf.py "${pdfPath}" "${docxPath}"`, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
      if (err) {
        console.error("Conversion error:", stderr || err);
        return res.status(500).send("Conversion failed: " + (stderr || err.message));
      }

      if (!fs.existsSync(docxPath)) {
        console.error("Converted docx missing:", docxPath);
        return res.status(500).send("Converted file not found");
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${docxName}"`);
      const stream = fs.createReadStream(docxPath);
      stream.pipe(res);
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error: " + e.message);
  }
});

// ------ 2) HTML -> PDF (edited content from editor) ------
app.post("/html-to-pdf", (req, res) => {
  try {
    const html = req.body.html;
    if (!html) return res.status(400).send("No HTML provided");

    const tempHtml = path.join("uploads", `edited_${Date.now()}.html`);
    const outPdf = path.join("converted", `edited_${Date.now()}.pdf`);
    fs.writeFileSync(tempHtml, html, "utf8");

    console.log("Converting edited HTML to PDF:", tempHtml);

    exec(`python3 convert_html_to_pdf.py "${tempHtml}" "${outPdf}"`, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
      if (err) {
        console.error("HTML->PDF error:", stderr || err);
        return res.status(500).send("PDF conversion failed: " + (stderr || err.message));
      }

      if (!fs.existsSync(outPdf)) {
        console.error("PDF not created:", outPdf);
        return res.status(500).send("PDF file not created");
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${path.basename(outPdf)}"`);
      const stream = fs.createReadStream(outPdf);
      stream.pipe(res);
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error: " + e.message);
  }
});

// ------ 3) Compress PDF (accepts a PDF upload) ------
app.post("/compress-pdf", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No file uploaded for compression");

    const inputPdf = req.file.path;
    const outName = req.file.filename.replace(/\.pdf$/i, "_compressed.pdf");
    const outPdf = path.join("converted", outName);

    // Ghostscript command (must be installed)
    const gsCmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outPdf}" "${inputPdf}"`;

    exec(gsCmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
      if (err) {
        console.error("Compression error:", stderr || err);
        return res.status(500).send("Compression failed: " + (stderr || err.message));
      }
      if (!fs.existsSync(outPdf)) return res.status(500).send("Compressed PDF missing");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${outName}"`);
      fs.createReadStream(outPdf).pipe(res);
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error: " + e.message);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
