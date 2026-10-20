import os
import hashlib
import json
import re
from typing import Dict, Any, List, Tuple
from app.core.config import settings

class DocumentProcessor:
    def __init__(self):
        os.makedirs(settings.STORAGE_PATH, exist_ok=True)

    def calculate_file_hash(self, file_bytes: bytes) -> str:
        return hashlib.sha256(file_bytes).hexdigest()

    def save_file(self, patient_id: str, doc_id: str, filename: str, file_bytes: bytes) -> str:
        patient_dir = os.path.join(settings.STORAGE_PATH, patient_id)
        os.makedirs(patient_dir, exist_ok=True)
        _, ext = os.path.splitext(filename)
        dest_filename = f"{doc_id}{ext}"
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
                for page_idx in range(page_count):
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
                # If pymupdf fails, fallback to pypdf or text reading
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
            # Try OCR if configured or return placeholder
            ocr_text = self._attempt_ocr(file_path)
            return ocr_text, [{"page": 1, "blocks": [{"text": ocr_text, "bbox": {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.8}}], "text": ocr_text}], 1

    def _attempt_ocr(self, file_path: str) -> str:
        if settings.TESSERACT_CMD:
            try:
                import pytesseract
                from PIL import Image
                pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
                image = Image.open(file_path)
                return pytesseract.image_to_string(image)
            except Exception as e:
                return f"[OCR unavailable or failed: {str(e)}. Document stored securely.]"
        return "[Scanned document / Image uploaded. OCR Engine not configured in environment. Original file preserved.]"

document_processor = DocumentProcessor()
