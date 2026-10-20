import os
import hashlib
import json
import re
import shutil
from typing import Dict, Any, List, Tuple, Optional
from app.core.config import settings

def get_tesseract_cmd() -> Optional[str]:
    """Uniform Tesseract discovery used across OCR execution and diagnostics."""
    if settings.TESSERACT_CMD and os.path.exists(settings.TESSERACT_CMD):
        return settings.TESSERACT_CMD
    which_cmd = shutil.which("tesseract")
    if which_cmd:
        return which_cmd
    return None

class DocumentProcessor:
    def __init__(self):
        os.makedirs(settings.STORAGE_PATH, exist_ok=True)

    def calculate_file_hash(self, file_bytes: bytes) -> str:
        return hashlib.sha256(file_bytes).hexdigest()

    def validate_file(self, file_bytes: bytes, filename: str, declared_mime: str) -> Tuple[bool, str]:
        """
        Validates file size, signature, and allowed extensions.
        Rejects executable headers, HTML/SVG script vectors, and invalid magic numbers.
        """
        if len(file_bytes) == 0:
            return False, "Uploaded file is empty."
        if len(file_bytes) > 30 * 1024 * 1024:
            return False, "File exceeds maximum size limit of 30MB."

        clean_name = os.path.basename(filename).lower()
        _, ext = os.path.splitext(clean_name)

        ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".txt", ".csv"}
        if ext not in ALLOWED_EXTENSIONS:
            return False, f"Unsupported file extension '{ext}'. Allowed formats: PDF, PNG, JPG, JPEG, TXT, CSV."

        # Magic number / file signature checks
        if ext == ".pdf":
            if not file_bytes.startswith(b"%PDF"):
                return False, "Corrupt or invalid PDF: missing standard '%PDF' file header signature."
        elif ext == ".png":
            if not file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
                return False, "Invalid PNG file signature."
        elif ext in (".jpg", ".jpeg"):
            if not file_bytes.startswith(b"\xff\xd8\xff"):
                return False, "Invalid JPEG file signature."
        elif ext in (".txt", ".csv"):
            # Check for executable headers like PE/MZ or ELF
            if file_bytes.startswith(b"MZ") or file_bytes.startswith(b"\x7fELF"):
                return False, "Security rejection: executable binaries are strictly forbidden."
            # Check UTF-8 readability
            try:
                file_bytes[:4096].decode("utf-8")
            except UnicodeDecodeError:
                return False, "Invalid text document: file content is not valid UTF-8."

        return True, "Valid"

    def save_file(self, patient_id: str, doc_id: str, filename: str, file_bytes: bytes) -> str:
        # Sanitize patient_id and doc_id against path traversal
        safe_pid = os.path.basename(patient_id)
        safe_did = os.path.basename(doc_id)
        patient_dir = os.path.join(settings.STORAGE_PATH, safe_pid)
        os.makedirs(patient_dir, exist_ok=True)
        _, ext = os.path.splitext(os.path.basename(filename))
        dest_filename = f"{safe_did}{ext}"
        dest_path = os.path.join(patient_dir, dest_filename)
        with open(dest_path, "wb") as f:
            f.write(file_bytes)
        return dest_path

    def extract_text_and_blocks(self, file_path: str, mime_type: str) -> Tuple[str, List[Dict[str, Any]], int]:
        """
        Extracts structured text, page count, and bounding blocks from PDF or text/image file.
        Returns (full_text, pages_with_blocks, page_count).
        """
        full_text_parts = []
        pages_data = []

        if "pdf" in mime_type.lower() or file_path.lower().endswith(".pdf"):
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(file_path)
                page_count = len(doc)
                # Limit page count to prevent denial-of-service on extreme files
                max_pages = min(page_count, 50)
                for page_idx in range(max_pages):
                    page = doc[page_idx]
                    page_text = page.get_text("text")
                    full_text_parts.append(f"--- PAGE {page_idx + 1} ---\n{page_text}")
                    
                    # Extract bounding blocks for visual highlight coordinate mapping
                    blocks = page.get_text("blocks") # (x0, y0, x1, y1, text, block_no, block_type)
                    rect = page.rect
                    page_blocks = []
                    for b in blocks:
                        if len(b) >= 5 and b[4].strip():
                            # Normalize coordinates to 0..1 relative to page width and height
                            norm_x = round(b[0] / max(rect.width, 1.0), 4)
                            norm_y = round(b[1] / max(rect.height, 1.0), 4)
                            norm_w = round((b[2] - b[0]) / max(rect.width, 1.0), 4)
                            norm_h = round((b[3] - b[1]) / max(rect.height, 1.0), 4)
                            page_blocks.append({
                                "text": b[4].strip(),
                                "bbox": {"x": norm_x, "y": norm_y, "width": norm_w, "height": norm_h}
                            })
                    pages_data.append({"page": page_idx + 1, "blocks": page_blocks, "text": page_text})
                doc.close()
                return "\n\n".join(full_text_parts), pages_data, page_count
            except Exception as e:
                full_text_parts.append(f"PDF extraction notice: {str(e)}")
                return f"Error extracting PDF: {str(e)}", [], 1

        elif "text" in mime_type.lower() or file_path.lower().endswith((".txt", ".csv")):
            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                return content, [{"page": 1, "blocks": [{"text": content, "bbox": {"x": 0.05, "y": 0.05, "width": 0.9, "height": 0.9}}], "text": content}], 1
            except Exception as e:
                return f"Error reading text document: {str(e)}", [], 1

        else:
            # Image files (PNG, JPG, JPEG)
            ocr_text = self._attempt_ocr(file_path)
            return ocr_text, [{"page": 1, "blocks": [{"text": ocr_text, "bbox": {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.8}}], "text": ocr_text}], 1

    def _attempt_ocr(self, file_path: str) -> str:
        tess_path = get_tesseract_cmd()
        if tess_path:
            try:
                import pytesseract
                from PIL import Image
                pytesseract.pytesseract.tesseract_cmd = tess_path
                image = Image.open(file_path)
                return pytesseract.image_to_string(image)
            except Exception as e:
                return f"[OCR execution failed: {str(e)}. Original file preserved.]"
        return (
            "[Scanned document or image uploaded. Tesseract OCR engine is not detected on system PATH. "
            "To enable OCR, install Tesseract-OCR and configure TESSERACT_CMD in backend/.env. Original file preserved.]"
        )

document_processor = DocumentProcessor()
