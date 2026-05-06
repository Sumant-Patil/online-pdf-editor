// frontend/index.js

const uploadBtn =
  document.getElementById("uploadBtn");

const fileInput =
  document.getElementById("fileInput");

const status =
  document.getElementById("status");

const editorSection =
  document.getElementById("editor-section");

const downloadDocxBtn =
  document.getElementById("downloadDocxBtn");

const saveBtn =
  document.getElementById("saveBtn");

const editor =
  document.getElementById("editor");

let lastDocxBlob = null;

// =====================================
// Upload PDF -> Convert -> Load Editor
// =====================================

uploadBtn.addEventListener("click", async () => {

  const file = fileInput.files[0];

  if (!file) {
    status.textContent =
      "Please select a PDF file.";
    return;
  }

  status.textContent =
    "Uploading and converting... ⏳";

  const form = new FormData();

  form.append("file", file);

  try {

    const res = await fetch("/upload", {
      method: "POST",
      body: form
    });

    if (!res.ok) {

      const errorText = await res.text();

      throw new Error(errorText);
    }

    // Receive DOCX blob
    const blob = await res.blob();

    lastDocxBlob = blob;

    // =====================================
    // Download DOCX Button
    // =====================================

    downloadDocxBtn.style.display =
      "inline-block";

    downloadDocxBtn.onclick = () => {

      const a =
        document.createElement("a");

      a.href =
        URL.createObjectURL(blob);

      a.download =
        (file.name || "converted")
          .replace(/\.pdf$/i, ".docx");

      a.click();
    };

    // =====================================
    // DOCX -> HTML
    // =====================================

    const arrayBuffer =
      await blob.arrayBuffer();

    const result =
      await mammoth.convertToHtml({
        arrayBuffer
      });

    // Create temporary container
    const tempDiv =
      document.createElement("div");

    tempDiv.innerHTML =
      result.value || "<p>Empty document</p>";

    // =====================================
    // Improve image rendering
    // =====================================

    const images =
      tempDiv.querySelectorAll("img");

    images.forEach((img) => {

      // Preserve aspect ratio
      img.style.maxWidth = "100%";

      img.style.height = "auto";

      img.style.display = "block";

      img.style.margin = "10px auto";

      img.style.objectFit = "contain";

      // Prevent stretching
      img.removeAttribute("width");
      img.removeAttribute("height");

      // Better rendering
      img.style.imageRendering = "auto";

      // Responsive behavior
      img.style.borderRadius = "8px";
    });

    // =====================================
    // Improve table rendering
    // =====================================

    const tables =
      tempDiv.querySelectorAll("table");

    tables.forEach((table) => {

      table.style.width = "100%";

      table.style.borderCollapse = "collapse";

      table.style.marginBottom = "20px";

      table.querySelectorAll("td, th")
        .forEach(cell => {

          cell.style.border =
            "1px solid #ddd";

          cell.style.padding =
            "8px";
        });
    });

    // =====================================
    // Load into editor
    // =====================================

    editor.innerHTML =
      tempDiv.innerHTML;

    editorSection.classList.remove("hidden");

    status.textContent =
      "Document loaded successfully ✅";

  } catch (err) {

    console.error(err);

    status.textContent =
      "Error: " + err.message;
  }
});

// =====================================
// Save Edited HTML -> PDF
// =====================================

saveBtn.addEventListener("click", async () => {

  try {

    const htmlContent =
      editor.innerHTML;

    status.textContent =
      "Generating PDF... ⏳";

    const res = await fetch("/html-to-pdf", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        html: htmlContent
      })
    });

    if (!res.ok) {

      const errorText =
        await res.text();

      throw new Error(errorText);
    }

    const pdfBlob =
      await res.blob();

    const url =
      URL.createObjectURL(pdfBlob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download = "edited.pdf";

    a.click();

    status.textContent =
      "PDF downloaded successfully ✅";

  } catch (err) {

    console.error(err);

    status.textContent =
      "Error: " + err.message;
  }
});
