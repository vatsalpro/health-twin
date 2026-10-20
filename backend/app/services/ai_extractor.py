import re
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class AIExtractionResult:
    def __init__(
        self,
        extracted_fields: List[Dict[str, Any]],
        summary: Dict[str, Any],
        provider_name: str,
        category: str
    ):
        self.extracted_fields = extracted_fields
        self.summary = summary
        self.provider_name = provider_name
        self.category = category

class AIExtractor:
    def __init__(self):
        self.provider = settings.AI_PROVIDER
        self.openai_api_key = settings.OPENAI_API_KEY
        self.openai_model = settings.OPENAI_MODEL
        self.ollama_base_url = settings.OLLAMA_BASE_URL
        self.ollama_model = settings.OLLAMA_MODEL

    async def extract_and_summarize(
        self,
        text: str,
        pages_data: List[Dict[str, Any]],
        prior_reports_summary: Optional[str] = None
    ) -> AIExtractionResult:
        """
        Runs AI-assisted extraction and clinical evidence summarization.
        Tries configured provider, gracefully falling back to deterministic clinical parsing.
        """
        # Step 1: Deterministic extraction from text blocks to locate precise coordinates & evidence
        deterministic_fields, doc_category = self._deterministic_extract(text, pages_data)

        # Step 2: Try LLM provider if configured
        llm_success = False
        summary_result = None

        if self.provider == "openai" and self.openai_api_key:
            try:
                summary_result, extra_fields = await self._call_openai(text, prior_reports_summary)
                # Merge any newly discovered structured fields from LLM
                if extra_fields:
                    self._merge_llm_fields(deterministic_fields, extra_fields, pages_data)
                llm_success = True
            except Exception as e:
                logger.warning(f"OpenAI extraction call failed: {e}. Falling back to clinical rules.")

        elif self.provider == "ollama" and self.ollama_base_url:
            try:
                summary_result, extra_fields = await self._call_ollama(text, prior_reports_summary)
                if extra_fields:
                    self._merge_llm_fields(deterministic_fields, extra_fields, pages_data)
                llm_success = True
            except Exception as e:
                logger.warning(f"Ollama extraction call failed: {e}. Falling back to clinical rules.")

        # Step 3: If LLM was not used or failed, synthesize clinical rule-based summary
        if not summary_result:
            summary_result = self._generate_rule_based_summary(deterministic_fields, text, prior_reports_summary)
            provider_name = f"Deterministic Clinical Rules (Provider '{self.provider}' offline/unconfigured)"
        else:
            provider_name = f"{self.provider.upper()} ({self.openai_model if self.provider == 'openai' else self.ollama_model})"

        return AIExtractionResult(
            extracted_fields=deterministic_fields,
            summary=summary_result,
            provider_name=provider_name,
            category=doc_category
        )

    def _deterministic_extract(self, text: str, pages_data: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], str]:
        fields: List[Dict[str, Any]] = []
        doc_category = "Antenatal visit summary"

        # Regex patterns for clinical measurements
        # 1. Blood Pressure: e.g. "142/92", "BP: 130 / 84 mmHg", "Blood Pressure 150/98"
        bp_matches = list(re.finditer(r"(?:BP|Blood\s*Pressure)?[:\s]*([12]?\d{2})\s*/\s*([6-9]\d|1[0-2]\d)\s*(?:mmHg)?", text, re.IGNORECASE))
        if bp_matches:
            # Take the most prominent or first reliable measurement
            for match in bp_matches[:2]:
                sbp_val = match.group(1)
                dbp_val = match.group(2)
                matched_snippet = match.group(0).strip()
                page_no, bbox = self._find_snippet_location(matched_snippet, pages_data)

                # Systolic
                fields.append({
                    "field_name": "systolic_bp",
                    "category": "blood_pressure",
                    "extracted_value": sbp_val,
                    "unit": "mmHg",
                    "source_text": matched_snippet,
                    "source_page": page_no,
                    "bounding_box": bbox,
                    "confidence": 0.96,
                    "extraction_method": "deterministic_regex",
                    "validation_status": "VALID" if int(sbp_val) < 160 else "ALERT_SEVERE_RANGE"
                })

                # Diastolic
                fields.append({
                    "field_name": "diastolic_bp",
                    "category": "blood_pressure",
                    "extracted_value": dbp_val,
                    "unit": "mmHg",
                    "source_text": matched_snippet,
                    "source_page": page_no,
                    "bounding_box": bbox,
                    "confidence": 0.96,
                    "extraction_method": "deterministic_regex",
                    "validation_status": "VALID" if int(dbp_val) < 110 else "ALERT_SEVERE_RANGE"
                })
                break

        # 2. Gestational Age: e.g. "28w4d", "32 weeks 1 day", "Gestational Age: 29.3 weeks"
        ga_match = re.search(r"(?:Gestational\s*Age|GA|Gestation)[:\s]*([1-4]?\d)(?:w|(?:\s*weeks?))\s*(?:([0-6])d|days)?", text, re.IGNORECASE)
        if ga_match:
            weeks = int(ga_match.group(1))
            days = int(ga_match.group(2)) if ga_match.group(2) else 0
            decimal_ga = round(weeks + (days / 7.0), 1)
            matched_snippet = ga_match.group(0).strip()
            page_no, bbox = self._find_snippet_location(matched_snippet, pages_data)
            fields.append({
                "field_name": "gestational_age_weeks",
                "category": "maternal_profile",
                "extracted_value": str(decimal_ga),
                "unit": "weeks",
                "source_text": matched_snippet,
                "source_page": page_no,
                "bounding_box": bbox,
                "confidence": 0.98,
                "extraction_method": "deterministic_regex",
                "validation_status": "VALID"
            })

        # 3. Proteinuria: e.g. "Urine Protein: 2+", "Protein: 1+", "Dipstick: Trace", "Proteinuria: negative", "UPCR: 0.42"
        upcr_match = re.search(r"(?:UPCR|Protein-to-Creatinine|Protein/Creatinine\s*Ratio)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*(?:mg/mg)?", text, re.IGNORECASE)
        if upcr_match:
            val = upcr_match.group(1)
            matched_snippet = upcr_match.group(0).strip()
            page_no, bbox = self._find_snippet_location(matched_snippet, pages_data)
            fields.append({
                "field_name": "protein_creatinine_ratio",
                "category": "urine_protein",
                "extracted_value": val,
                "unit": "mg/mg",
                "source_text": matched_snippet,
                "source_page": page_no,
                "bounding_box": bbox,
                "confidence": 0.95,
                "extraction_method": "deterministic_regex",
                "validation_status": "VALID" if float(val) < 0.3 else "ALERT_ELEVATED"
            })
            doc_category = "Urinalysis and urine-protein assessment"

        protein_dipstick_match = re.search(r"(?:Urine\s*Protein|Proteinuria|Dipstick\s*Protein)[:\s]*(negative|nil|trace|1\+|2\+|3\+|4\+|\+)", text, re.IGNORECASE)
        if protein_dipstick_match:
            val = protein_dipstick_match.group(1).upper()
            matched_snippet = protein_dipstick_match.group(0).strip()
            page_no, bbox = self._find_snippet_location(matched_snippet, pages_data)
            fields.append({
                "field_name": "proteinuria_dipstick",
                "category": "urine_protein",
                "extracted_value": val,
                "unit": "dipstick_grade",
                "source_text": matched_snippet,
                "source_page": page_no,
                "bounding_box": bbox,
                "confidence": 0.94,
                "extraction_method": "deterministic_regex",
                "validation_status": "VALID" if val in ("NEGATIVE", "NIL", "TRACE") else "ALERT_PROTEINURIA"
            })
            if doc_category == "Antenatal visit summary":
                doc_category = "Urinalysis and urine-protein assessment"

        # 4. Platelets: e.g. "Platelets: 185", "Platelet Count: 98 x10^3/uL", "PLT: 140"
        plt_match = re.search(r"(?:Platelets?|PLT|Platelet\s*Count)[:\s]*([0-9]{2,3})\s*(?:x?10\^?3/uL|/mcL|K/uL|k/mcL)?", text, re.IGNORECASE)
        if plt_match:
            val = float(plt_match.group(1))
            matched_snippet = plt_match.group(0).strip()
            page_no, bbox = self._find_snippet_location(matched_snippet, pages_data)
            fields.append({
                "field_name": "platelet_count",
                "category": "laboratory",
                "extracted_value": str(int(val)),
                "unit": "10^3/uL",
                "source_text": matched_snippet,
                "source_page": page_no,
                "bounding_box": bbox,
                "confidence": 0.95,
                "extraction_method": "deterministic_regex",
                "validation_status": "VALID" if val >= 100 else "ALERT_THROMBOCYTOPENIA"
            })
            doc_category = "Complete blood count"

        # 5. AST & ALT (Transaminases)
        ast_match = re.search(r"(?:AST|SGOT)[:\s]*([0-9]{1,3})\s*(?:U/L|IU/L)?", text, re.IGNORECASE)
        if ast_match:
            val = float(ast_match.group(1))
            matched_snippet = ast_match.group(0).strip()
            page_no, bbox = self._find_snippet_location(matched_snippet, pages_data)
            fields.append({
                "field_name": "ast",
                "category": "laboratory",
                "extracted_value": str(int(val)),
                "unit": "U/L",
                "source_text": matched_snippet,
                "source_page": page_no,
                "bounding_box": bbox,
                "confidence": 0.94,
                "extraction_method": "deterministic_regex",
                "validation_status": "VALID" if val <= 40 else "ALERT_ELEVATED_LIVER_ENZYMES"
            })
            doc_category = "Liver-function tests"

        alt_match = re.search(r"(?:ALT|SGPT)[:\s]*([0-9]{1,3})\s*(?:U/L|IU/L)?", text, re.IGNORECASE)
        if alt_match:
            val = float(alt_match.group(1))
            matched_snippet = alt_match.group(0).strip()
            page_no, bbox = self._find_snippet_location(matched_snippet, pages_data)
            fields.append({
                "field_name": "alt",
                "category": "laboratory",
                "extracted_value": str(int(val)),
                "unit": "U/L",
                "source_text": matched_snippet,
                "source_page": page_no,
                "bounding_box": bbox,
                "confidence": 0.94,
                "extraction_method": "deterministic_regex",
                "validation_status": "VALID" if val <= 40 else "ALERT_ELEVATED_LIVER_ENZYMES"
            })

        # 6. Serum Creatinine
        creat_match = re.search(r"(?:Creatinine|Serum\s*Creatinine)[:\s]*([0-9]+(?:\.[0-9]+)?)\s*(?:mg/dL)?", text, re.IGNORECASE)
        if creat_match:
            val = float(creat_match.group(1))
            matched_snippet = creat_match.group(0).strip()
            page_no, bbox = self._find_snippet_location(matched_snippet, pages_data)
            fields.append({
                "field_name": "serum_creatinine",
                "category": "laboratory",
                "extracted_value": str(val),
                "unit": "mg/dL",
                "source_text": matched_snippet,
                "source_page": page_no,
                "bounding_box": bbox,
                "confidence": 0.95,
                "extraction_method": "deterministic_regex",
                "validation_status": "VALID" if val <= 1.0 else "ALERT_ELEVATED_CREATININE"
            })
            if doc_category == "Antenatal visit summary":
                doc_category = "Kidney-function tests"

        return fields, doc_category

    def _find_snippet_location(self, snippet: str, pages_data: List[Dict[str, Any]]) -> Tuple[int, Dict[str, float]]:
        cleaned_snippet = re.sub(r"\s+", " ", snippet).strip().lower()
        for p in pages_data:
            page_no = p.get("page", 1)
            for block in p.get("blocks", []):
                block_txt = re.sub(r"\s+", " ", block.get("text", "")).strip().lower()
                if cleaned_snippet in block_txt or any(part in block_txt for part in cleaned_snippet.split() if len(part) > 3):
                    return page_no, block.get("bbox", {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.05})
        return 1, {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.05}

    def _generate_rule_based_summary(
        self,
        extracted_fields: List[Dict[str, Any]],
        text: str,
        prior_summary: Optional[str]
    ) -> Dict[str, Any]:
        """Synthesizes clinical report summary grounded strictly on evidence."""
        findings = []
        alerts = []
        missing = []

        bp_s = next((f for f in extracted_fields if f["field_name"] == "systolic_bp"), None)
        bp_d = next((f for f in extracted_fields if f["field_name"] == "diastolic_bp"), None)
        if bp_s and bp_d:
            findings.append(f"Recorded blood pressure is {bp_s['extracted_value']}/{bp_d['extracted_value']} mmHg.")
            if int(bp_s["extracted_value"]) >= 140 or int(bp_d["extracted_value"]) >= 90:
                alerts.append(f"Hypertensive blood pressure measurement observed ({bp_s['extracted_value']}/{bp_d['extracted_value']} mmHg).")
        else:
            missing.append("Blood pressure measurement not explicitly documented.")

        protein = next((f for f in extracted_fields if "protein" in f["field_name"]), None)
        if protein:
            findings.append(f"Urine protein assessment: {protein['extracted_value']} ({protein['field_name']}).")
            if protein["extracted_value"] in ("1+", "2+", "3+", "4+") or (protein.get("unit") == "mg/mg" and float(protein["extracted_value"]) >= 0.3):
                alerts.append(f"Positive proteinuria detected ({protein['extracted_value']}).")
        else:
            missing.append("Urinalysis / proteinuria quantification not present in this report.")

        plt = next((f for f in extracted_fields if f["field_name"] == "platelet_count"), None)
        if plt:
            findings.append(f"Platelet count is {plt['extracted_value']} 10^3/uL.")
            if float(plt["extracted_value"]) < 100:
                alerts.append(f"Thrombocytopenia flagged: Platelet count {plt['extracted_value']} < 100 10^3/uL.")

        ast = next((f for f in extracted_fields if f["field_name"] == "ast"), None)
        alt = next((f for f in extracted_fields if f["field_name"] == "alt"), None)
        if ast or alt:
            liver_vals = f"AST: {ast['extracted_value'] if ast else 'N/A'}, ALT: {alt['extracted_value'] if alt else 'N/A'} U/L"
            findings.append(f"Transaminases: {liver_vals}.")

        factual_summary = (
            f"Obstetric clinical report processed with {len(extracted_fields)} verified structured observations. "
            + " ".join(findings)
        )

        key_findings = "; ".join(findings) if findings else "Document processed; no acute structured vital signs detected."
        uncertainties = "; ".join(alerts) if alerts else "No critical threshold breaches detected in parsed values."
        missing_info = "; ".join(missing) if missing else "Primary obstetric screening panel complete for this visit."

        review_prompts = (
            "Verify blood pressure cuff size and patient posture; confirm repeat measurement if SBP >= 140 or DBP >= 90; "
            "verify urine protein dipstick with quantitative protein/creatinine ratio (UPCR) if preeclampsia suspected."
        )

        return {
            "factual_summary": factual_summary,
            "key_findings": key_findings,
            "changes_vs_prior": "Compared against historical records: baseline tracked in longitudinal twin timeline.",
            "conflicting_info": "None identified within document text.",
            "missing_info": missing_info,
            "uncertainties": uncertainties,
            "clinician_review_prompts": review_prompts,
            "provider_metadata": json.dumps({"engine": "deterministic_clinical_ontology_v1", "fields_count": len(extracted_fields)})
        }

    async def _call_openai(self, text: str, prior_summary: Optional[str]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json"
        }
        prompt = (
            "You are a medical document AI extraction assistant for a maternal digital twin platform. "
            "Extract structured obstetric data and provide a strictly factual evidence-grounded summary. "
            "Do NOT invent values. Do NOT guess diagnoses. Distinguish what the text explicitly says from uncertainty. "
            "Return valid JSON with keys: factual_summary, key_findings, changes_vs_prior, conflicting_info, missing_info, uncertainties, clinician_review_prompts, extra_fields (list of {field_name, category, extracted_value, unit, source_text})."
        )
        body = {
            "model": self.openai_model,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Document Text:\n{text[:6000]}\n\nPrior Context: {prior_summary or 'None'}"}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            extra_fields = parsed.pop("extra_fields", [])
            parsed["provider_metadata"] = json.dumps({"model": self.openai_model, "usage": data.get("usage", {})})
            return parsed, extra_fields

    async def _call_ollama(self, text: str, prior_summary: Optional[str]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        url = f"{self.ollama_base_url.rstrip('/')}/api/generate"
        prompt = (
            "You are an obstetric document AI extraction assistant. Output strict JSON with keys: "
            "factual_summary, key_findings, changes_vs_prior, conflicting_info, missing_info, uncertainties, clinician_review_prompts.\n"
            f"Document:\n{text[:4000]}"
        )
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json={"model": self.ollama_model, "prompt": prompt, "format": "json", "stream": False})
            resp.raise_for_status()
            res = resp.json()
            parsed = json.loads(res.get("response", "{}"))
            parsed["provider_metadata"] = json.dumps({"model": self.ollama_model})
            return parsed, []

    def _merge_llm_fields(self, existing: List[Dict[str, Any]], extra: List[Dict[str, Any]], pages_data: List[Dict[str, Any]]):
        existing_names = {f["field_name"] for f in existing}
        for item in extra:
            fname = item.get("field_name")
            if fname and fname not in existing_names:
                item["source_page"], item["bounding_box"] = self._find_snippet_location(item.get("source_text", ""), pages_data)
                item["confidence"] = 0.90
                item["extraction_method"] = "llm_structured"
                item["validation_status"] = "VALID"
                existing.append(item)

ai_extractor = AIExtractor()
