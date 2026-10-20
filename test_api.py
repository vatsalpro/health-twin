import os
import httpx

port = os.getenv("PORT", "8008")
client = httpx.Client(base_url=f"http://127.0.0.1:{port}")

# 1. Login
auth_resp = client.post("/api/v1/auth/login", json={"email": "dr.elena@pregtwin.org", "password": "Clinician2026!"})
assert auth_resp.status_code == 200
token = auth_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print("Clinician Auth: OK")

# 2. Patients
patients_resp = client.get("/api/v1/patients", headers=headers)
assert patients_resp.status_code == 200
patients = patients_resp.json()
print(f"Total Patients: {len(patients)}")
for p in patients:
    print(f" - {p['first_name']} {p['last_name']} ({p['mrn']}) | Age: {p['maternal_age']}")

p1 = patients[0]

# 3. Digital Twin State
twin_resp = client.get(f"/api/v1/patients/{p1['id']}/twin", headers=headers)
assert twin_resp.status_code == 200
twin = twin_resp.json()
print(f"Patient 1 Twin State: SBP={twin['sbp']}, DBP={twin['dbp']}, MAP={twin['map_pressure']}, Platelets={twin['platelets']}, GA={twin['gestational_age_weeks']}w")

# 4. Predictions
pred_resp = client.get(f"/api/v1/patients/{p1['id']}/predictions", headers=headers)
assert pred_resp.status_code == 200
preds = pred_resp.json()
print(f"Prediction 14-Day Horizon: Score={preds[0]['risk_score']}, Category={preds[0]['risk_category']}, InsufficientData={preds[0]['is_insufficient_data']}")

# 5. Simulation
sim_resp = client.post(f"/api/v1/patients/{p1['id']}/simulate", headers=headers, json={
    "gestational_age_weeks": 31.4,
    "sbp": 155,
    "dbp": 98,
    "proteinuria_dipstick": "2+",
    "platelets": 130,
    "ast": 52,
    "alt": 44,
    "serum_creatinine": 0.95
})
assert sim_resp.status_code == 200
sim = sim_resp.json()
print(f"Simulation Outcome: Baseline={sim['baseline_risk_score']}, Simulated={sim['simulated_risk_score']}, Category={sim['simulated_risk_category']}, Delta={sim['delta_risk_score']}")

# 6. Model Evaluation
eval_resp = client.get("/api/v1/models/preeclampsia/evaluation", headers=headers)
assert eval_resp.status_code == 200
eval_data = eval_resp.json()
assert eval_data["evaluation_status"] == "not_evaluated"
assert eval_data["metrics_available"] is False
print(f"Research Model Evaluation: Status={eval_data['evaluation_status']}, MetricsAvailable={eval_data['metrics_available']}, Message='{eval_data['message']}'")

p3 = patients[2] # Clara Novak
preds_p3 = client.get(f"/api/v1/patients/{p3['id']}/predictions", headers=headers).json()
print(f"Clara Novak Guard Check: GA={p3['episodes'][0]['current_gestational_age_weeks']}w, Category={preds_p3[0]['risk_category']}, InsufficientData={preds_p3[0]['is_insufficient_data']}")
print(f" -> Reason: {preds_p3[0]['insufficient_data_reason']}")

print("\nALL BACKEND API WORKFLOW CHECKS PASSED PERFECTLY!")
