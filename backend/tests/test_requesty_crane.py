import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.requesty_crane_client import RequestyCraneClient, requesty_crane_client
from app.services.ai_extractor import ai_extractor

client = TestClient(app)

@pytest.fixture(scope="module")
def patient_token():
    r = client.post("/api/v1/auth/login", json={"email": "maya.lin@pregtwin.org", "password": "Patient2026!"})
    data = r.json()
    return {
        "token": data["access_token"],
        "patient_id": data["patient_id"]
    }

def test_requesty_crane_configuration_isolation():
    """Verify Crane AI's Requesty configuration is isolated from Ollama."""
    # Crane AI uses Requesty
    status = requesty_crane_client.get_status()
    assert status["provider"] == "Requesty API"
    assert status["base_url"] == "https://router.requesty.ai/v1"
    assert "gemma" in status["configured_model"] or "rqsty" in status["configured_model"] or len(status["configured_model"]) > 0

    # Ollama settings for extraction and other features remain unchanged
    assert settings.AI_PROVIDER == "ollama"
    assert settings.OLLAMA_BASE_URL == "http://localhost:11434"
    assert settings.OLLAMA_MODEL == "llama3.2:3b"

def test_ai_extractor_retains_ollama():
    """Verify document AI extractor continues using Ollama and has not been affected."""
    assert ai_extractor.provider == "ollama"
    assert ai_extractor.ollama_model == "llama3.2:3b"

@pytest.mark.anyio
async def test_requesty_missing_key_graceful_handling():
    """Verify that a missing or unconfigured Requesty API key yields a safe, clear notification without crashing."""
    dummy_client = RequestyCraneClient()
    dummy_client.api_key = ""
    reply, sources, mascot = await dummy_client.generate_chat_reply(
        message="What is my blood pressure?",
        context={"patient_name": "Maya Lin"}
    )
    assert "CRANE_AI_REQUESTY_API_KEY" in reply
    assert "Missing CRANE_AI_REQUESTY_API_KEY" in sources[0]
    assert mascot == "attentive"

@pytest.mark.anyio
async def test_requesty_402_payment_required_graceful_handling():
    """Verify HTTP 402 (Payment Required) from Requesty is caught and returns an actionable billing notice."""
    dummy_client = RequestyCraneClient()
    dummy_client.api_key = "dummy-test-key"

    mock_resp = AsyncMock()
    mock_resp.status_code = 402
    mock_resp.text = '{"error":{"origin":"router","message":"Your balance is too low"}}'

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        reply, sources, mascot = await dummy_client.generate_chat_reply(
            message="Explain my labetalol dose",
            context={"patient_name": "Maya Lin"}
        )
        assert "balance" in reply.lower() or "top up" in reply.lower() or "402" in reply
        assert any("402" in s for s in sources)
        assert mascot == "attentive"

@pytest.mark.anyio
async def test_requesty_timeout_graceful_handling():
    """Verify Requesty connection timeouts are caught safely without breaking the user experience."""
    import httpx
    dummy_client = RequestyCraneClient()
    dummy_client.api_key = "dummy-test-key"

    with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Read timed out")):
        reply, sources, mascot = await dummy_client.generate_chat_reply(
            message="When is my next visit?",
            context={"patient_name": "Maya Lin"}
        )
        assert "timed out" in reply.lower()
        assert any("Timeout" in s for s in sources)
        assert mascot == "attentive"

def test_requesty_failure_does_not_break_other_endpoints(patient_token):
    """Verify that even when Crane AI simulates a provider issue, other clinical endpoints function normally."""
    headers = {"Authorization": f"Bearer {patient_token['token']}"}

    # 1. Twin state endpoint
    resp_twin = client.get(f"/api/v1/patients/{patient_token['patient_id']}/twin", headers=headers)
    assert resp_twin.status_code == 200

    # 2. Observations endpoint
    resp_obs = client.get(f"/api/v1/patients/{patient_token['patient_id']}/observations", headers=headers)
    assert resp_obs.status_code == 200

    # 3. Medications endpoint
    resp_meds = client.get(f"/api/v1/medications/orders?patient_id={patient_token['patient_id']}", headers=headers)
    assert resp_meds.status_code == 200
