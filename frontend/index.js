// frontend/index.js
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const status = document.getElementById("status");
const editorSection = document.getElementById("editor-section");
const downloadDocxBtn = document.getElementById("downloadDocxBtn");
const saveBtn = document.getElementById("saveBtn");
const compressBtn = document.getElementById("compressBtn");

// TinyMCE init
tinymce.init({
  selector: "#editor",
  height: 480,
  menubar: true,
  plugins: "lists link image table code",
  toolbar: "undo redo | styles | bold italic underline | alignleft aligncenter alignright | bullist numlist outdent indent | table | code",
}).then(() => {
  console.log("TinyMCE ready");
});

let lastDocxBlob = null;
let lastPdfBlob = null;

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    status.textContent = "Please select a PDF file.";
    return;
  }

  status.textContent = "Uploading and converting... ⏳";
  const form = new FormData();
  form.append("file", file);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      body: form
    });

    if (!res.ok) throw new Error("Upload/convert failed: " + res.statusText);

    // receive docx as blob
    const blob = await res.blob();
    lastDocxBlob = blob;

    // set download button for raw docx
    downloadDocxBtn.style.display = "inline-block";
    downloadDocxBtn.onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (file.name || "converted") .replace(/\.pdf$/i, ".docx");
      a.click();
    };

    // Convert docx blob -> ArrayBuffer -> mammoth convertToHtml
    const arrayBuffer = await blob.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value || "<p>(empty)</p>";

    // Set content into TinyMCE
    const editor = tinymce.get("editor");
    editor.setContent(html);
    editorSection.classList.remove("hidden");
    status.textContent = "DOCX loaded into editor ✅";
  } catch (err) {
    console.error(err);
    status.textContent = "Error: " + err.message;
  }
});

// Save edited doc content (HTML) and convert to PDF on server
saveBtn.addEventListener("click", async () => {
  try {
    const editor = tinymce.get("editor");
    const htmlContent = editor.getContent();

    status.textContent = "Sending edited content to server for PDF conversion... ⏳";

    const res = await fetch("/html-to-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: htmlContent })
    });

    if (!res.ok) throw new Error("PDF conversion failed: " + res.statusText);

    const pdfBlob = await res.blob();
    lastPdfBlob = pdfBlob;

    // create download link (auto click)
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edited.pdf";
    a.click();

    status.textContent = "PDF created and downloaded ✅ You can compress it using Compress button.";
  } catch (err) {
    console.error(err);
    status.textContent = "Error: " + err.message;
  }
});

// Compress the last produced PDF on server
compressBtn.addEventListener("click", async () => {
  if (!lastPdfBlob) {
    status.textContent = "No PDF available yet. Save first to get a PDF to compress.";
    return;
  }

  status.textContent = "Uploading PDF to compress... ⏳";
  const form = new FormData();
  form.append("file", lastPdfBlob, "last.pdf");

  try {
    const res = await fetch("/compress-pdf", {
      method: "POST",
      body: form
    });

    if (!res.ok) throw new Error("Compression failed: " + res.statusText);

    const cblob = await res.blob();
    const url = URL.createObjectURL(cblob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edited_compressed.pdf";
    a.click();

    status.textContent = "Compressed PDF downloaded ✅";
  } catch (err) {
    console.error(err);
    status.textContent = "Error compressing: " + err.message;
  }
});
