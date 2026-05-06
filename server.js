// server.js (CommonJS)

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const cors = require("cors");

const app = express();

// Cross-platform Python command
const PYTHON_CMD = process.platform === "win32" ? "python" : "python3";

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Frontend folder
const FRONTEND_DIR = path.join(__dirname, "frontend");
app.use(express.static(FRONTEND_DIR));

// Create folders if not exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("converted")) fs.mkdirSync("converted");

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// ===============================
// HOME ROUTE
// ===============================
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// ===============================
// PDF -> DOCX
// ===============================
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const pdfPath = req.file.path;

    const docxName = req.file.filename.replace(/\.pdf$/i, ".docx");

    const docxPath = path.join("converted", docxName);

    console.log("Starting PDF conversion...");
    console.log("Input:", pdfPath);
    console.log("Output:", docxPath);

    const command = `${PYTHON_CMD} convert_pdf.py "${pdfPath}" "${docxPath}"`;

    console.log("Running:", command);

    exec(
      command,
      { maxBuffer: 1024 * 1024 * 50 },
      (err, stdout, stderr) => {

        console.log("STDOUT:", stdout);
        console.log("STDERR:", stderr);

        if (err) {
          console.error("Conversion Error:", err);
          return res.status(500).send(
            "Upload/convert failed: " + (stderr || err.message)
          );
        }

        if (!fs.existsSync(docxPath)) {
          console.error("DOCX file missing.");
          return res.status(500).send("Converted DOCX not found.");
        }

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${docxName}"`
        );

        fs.createReadStream(docxPath).pipe(res);
      }
    );

  } catch (e) {
    console.error("Server Error:", e);
    res.status(500).send("Server error: " + e.message);
  }
});

// ===============================
// HTML -> PDF
// ===============================
app.post("/html-to-pdf", (req, res) => {
  try {

    const html = req.body.html;

    if (!html) {
      return res.status(400).send("No HTML provided");
    }

    const tempHtml = path.join(
      "uploads",
      `edited_${Date.now()}.html`
    );

    const outPdf = path.join(
      "converted",
      `edited_${Date.now()}.pdf`
    );

    fs.writeFileSync(tempHtml, html, "utf8");

    console.log("Converting HTML -> PDF");
    console.log("HTML:", tempHtml);
    console.log("PDF:", outPdf);

    const command =
      `${PYTHON_CMD} convert_html_to_pdf.py "${tempHtml}" "${outPdf}"`;

    exec(
      command,
      { maxBuffer: 1024 * 1024 * 50 },
      (err, stdout, stderr) => {

        console.log("STDOUT:", stdout);
        console.log("STDERR:", stderr);

        if (err) {
          console.error("HTML->PDF Error:", err);

          return res.status(500).send(
            "PDF conversion failed: " + (stderr || err.message)
          );
        }

        if (!fs.existsSync(outPdf)) {
          return res.status(500).send("PDF not created.");
        }

        res.setHeader("Content-Type", "application/pdf");

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${path.basename(outPdf)}"`
        );

        fs.createReadStream(outPdf).pipe(res);
      }
    );

  } catch (e) {
    console.error(e);
    res.status(500).send("Server error: " + e.message);
  }
});

// ===============================
// PDF Compression
// ===============================
app.post("/compress-pdf", upload.single("file"), (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).send("No PDF uploaded.");
    }

    const inputPdf = req.file.path;

    const outName = req.file.filename.replace(
      /\.pdf$/i,
      "_compressed.pdf"
    );

    const outPdf = path.join("converted", outName);

    console.log("Compressing PDF...");

    const gsCmd = `
      gs
      -sDEVICE=pdfwrite
      -dCompatibilityLevel=1.4
      -dPDFSETTINGS=/ebook
      -dNOPAUSE
      -dQUIET
      -dBATCH
      -sOutputFile="${outPdf}"
      "${inputPdf}"
    `.replace(/\s+/g, " ");

    exec(
      gsCmd,
      { maxBuffer: 1024 * 1024 * 50 },
      (err, stdout, stderr) => {

        console.log("STDOUT:", stdout);
        console.log("STDERR:", stderr);

        if (err) {
          console.error("Compression Error:", err);

          return res.status(500).send(
            "Compression failed. Ghostscript may not exist on Render."
          );
        }

        if (!fs.existsSync(outPdf)) {
          return res.status(500).send("Compressed PDF missing.");
        }

        res.setHeader("Content-Type", "application/pdf");

        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${outName}"`
        );

        fs.createReadStream(outPdf).pipe(res);
      }
    );

  } catch (e) {
    console.error(e);
    res.status(500).send("Server error: " + e.message);
  }
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
