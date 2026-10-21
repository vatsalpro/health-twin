import math
import random
import uuid
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone, timedelta

class BaseDeviceConnector(ABC):
    """
    Abstract Base Class for all Maternal Health IoT and Wearable Device Connectors.
    Supports physical hardware adapters (BLE, Cloud API, HealthKit) and simulated connectors.
    """

    @abstractmethod
    def discover_devices(self) -> List[Dict[str, Any]]:
        """Scans or lists available compatible devices/sources."""
        pass

    @abstractmethod
    def verify_permissions(self) -> Dict[str, Any]:
        """Verifies platform/OS permissions (e.g. Bluetooth, HealthKit, Cloud OAuth)."""
        pass

    @abstractmethod
    def connect(self, device_id: str) -> Dict[str, Any]:
        """Establishes connection or authenticates session."""
        pass

    @abstractmethod
    def disconnect(self, device_id: str) -> bool:
        """Disconnects or closes session."""
        pass

    @abstractmethod
    def read_measurements(self, device_id: str, count: int = 1) -> List[Dict[str, Any]]:
        """Reads raw readings from the device or data stream."""
        pass

    @abstractmethod
    def normalize_measurement(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalizes raw hardware payloads into standardized PregTwin measurement schema."""
        pass

    @abstractmethod
    def get_status(self, device_id: str) -> Dict[str, Any]:
        """Reports device connection status, battery, and firmware."""
        pass


class MockDeviceConnector(BaseDeviceConnector):
    """
    High-Fidelity Mock Device Connector for testing end-to-end data pipelines
    without requiring physical Bluetooth/BLE or clinical hardware.
    Simulates:
      - Omron Evolv / Welch Allyn Upper Arm BP Monitor
      - Masimo MightySat Clinical Pulse Oximeter
      - Dexcom G7 / Accu-Chek Continuous & Capillary Glucose
      - Oura Ring Gen 4 / Garmin Multisport Smart Wearable
    """

    CATALOG = {
        "mock_bp_cuff": {
            "device_type": "blood_pressure_cuff",
            "manufacturer": "Omron Healthcare (Simulated)",
            "model_name": "Evolv Wireless Upper Arm BP Monitor",
            "protocol": "mock_ble",
            "supported_measurements": ["systolic_bp", "diastolic_bp", "pulse_rate"]
        },
        "mock_pulse_ox": {
            "device_type": "pulse_oximeter",
            "manufacturer": "Masimo (Simulated)",
            "model_name": "MightySat Medical Pulse Oximeter",
            "protocol": "mock_ble",
            "supported_measurements": ["spo2_pct", "pulse_rate", "perfusion_index"]
        },
        "mock_glucose_meter": {
            "device_type": "glucose_meter",
            "manufacturer": "Dexcom / Roche (Simulated)",
            "model_name": "G7 Continuous Glucose Monitor",
            "protocol": "mock_vendor_api",
            "supported_measurements": ["blood_glucose", "rate_of_change"]
        },
        "mock_wearable_ring": {
            "device_type": "smart_ring",
            "manufacturer": "Oura Health (Simulated)",
            "model_name": "Oura Ring Gen 4 Horizon",
            "protocol": "mock_cloud_api",
            "supported_measurements": ["resting_heart_rate", "hrv_rmssd", "sleep_duration", "activity_steps"]
        }
    }

    def __init__(self):
        self._connected_devices: Dict[str, Dict[str, Any]] = {}

    def discover_devices(self) -> List[Dict[str, Any]]:
        devices = []
        for dev_key, dev_info in self.CATALOG.items():
            devices.append({
                "device_id": dev_key,
                "device_type": dev_info["device_type"],
                "manufacturer": dev_info["manufacturer"],
                "model_name": dev_info["model_name"],
                "protocol": dev_info["protocol"],
                "supported_measurements": dev_info["supported_measurements"],
                "is_synthetic": True,
                "signal_strength_rssi": -58
            })
        return devices

    def verify_permissions(self) -> Dict[str, Any]:
        return {
            "permissions_granted": True,
            "bluetooth_available": True,
            "mock_mode_enabled": True,
            "notes": "Simulated hardware connectors operate in local virtual sandbox. Zero physical hardware needed."
        }

    def connect(self, device_id: str) -> Dict[str, Any]:
        if device_id not in self.CATALOG:
            # Create a generic dynamic mock device
            self.CATALOG[device_id] = {
                "device_type": "wearable_sensor",
                "manufacturer": "Generic IoT Mock",
                "model_name": "Custom Telemetry Node",
                "protocol": "mock",
                "supported_measurements": ["vitals"]
            }

        dev_meta = self.CATALOG[device_id]
        connection_data = {
            "device_id": device_id,
            "status": "connected",
            "battery_percentage": random.randint(72, 98),
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "firmware_version": "v2.4.1-simulated",
            "device_type": dev_meta["device_type"],
            "manufacturer": dev_meta["manufacturer"],
            "model_name": dev_meta["model_name"]
        }
        self._connected_devices[device_id] = connection_data
        return connection_data

    def disconnect(self, device_id: str) -> bool:
        if device_id in self._connected_devices:
            del self._connected_devices[device_id]
            return True
        return False

    def get_status(self, device_id: str) -> Dict[str, Any]:
        if device_id in self._connected_devices:
            st = self._connected_devices[device_id]
            st["last_ping"] = datetime.now(timezone.utc).isoformat()
            return st
        return {
            "device_id": device_id,
            "status": "disconnected",
            "battery_percentage": None,
            "error_message": None
        }

    def read_measurements(self, device_id: str, count: int = 1) -> List[Dict[str, Any]]:
        readings = []
        dev_info = self.CATALOG.get(device_id, {})
        dev_type = dev_info.get("device_type", "blood_pressure_cuff")
        now = datetime.now(timezone.utc)

        for i in range(count):
            reading_time = now - timedelta(minutes=(count - 1 - i) * 15)
            raw = {
                "device_id": device_id,
                "device_type": dev_type,
                "timestamp": reading_time.isoformat(),
                "battery": random.randint(70, 95)
            }

            if dev_type == "blood_pressure_cuff":
                raw.update({
                    "sbp": random.randint(122, 144),
                    "dbp": random.randint(78, 92),
                    "pulse": random.randint(68, 86),
                    "body_position": "sitting",
                    "cuff_fit": "optimal"
                })
            elif dev_type == "pulse_oximeter":
                raw.update({
                    "spo2": round(random.uniform(96.5, 99.2), 1),
                    "pulse": random.randint(70, 84),
                    "perfusion_index": round(random.uniform(1.8, 4.5), 2),
                    "signal_quality": "HIGH"
                })
            elif dev_type == "glucose_meter":
                raw.update({
                    "glucose_mg_dl": round(random.uniform(86.0, 118.0), 1),
                    "meal_context": random.choice(["fasting", "post_breakfast", "post_dinner"]),
                    "trend_arrow": "FLAT"
                })
            elif dev_type in ("smart_ring", "fitness_band", "wearable_sensor"):
                raw.update({
                    "resting_hr": random.randint(64, 76),
                    "hrv_rmssd_ms": round(random.uniform(32.0, 52.0), 1),
                    "sleep_hours": round(random.uniform(6.8, 8.4), 1),
                    "steps": random.randint(4500, 9200)
                })

            readings.append(self.normalize_measurement(raw))

        return readings

    def normalize_measurement(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalizes arbitrary device sensor reading into PregTwin unified schema.
        """
        dev_type = raw_data.get("device_type", "blood_pressure_cuff")
        ts_str = raw_data.get("timestamp") or datetime.now(timezone.utc).isoformat()
        try:
            meas_time = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except Exception:
            meas_time = datetime.now(timezone.utc)

        idempotency_key = f"mock_{raw_data.get('device_id')}_{meas_time.isoformat()}_{random.randint(100, 999)}"

        if dev_type == "blood_pressure_cuff":
            sbp = float(raw_data.get("sbp", 120))
            dbp = float(raw_data.get("dbp", 80))
            quality = "VALID"
            if sbp >= 160 or dbp >= 110:
                quality = "ALERT_SEVERE"
            elif sbp >= 140 or dbp >= 90:
                quality = "ALERT_ELEVATED"

            return {
                "measurement_type": "blood_pressure",
                "value_numeric": sbp,
                "value_secondary": dbp,
                "value_text": f"{int(sbp)}/{int(dbp)}",
                "unit": "mmHg",
                "measurement_timestamp": meas_time,
                "source_type": "mock_device",
                "device_manufacturer": "Omron Healthcare (Simulated)",
                "device_model": "Evolv Wireless",
                "context_data": {
                    "pulse": raw_data.get("pulse", 72),
                    "body_position": raw_data.get("body_position", "sitting"),
                    "arm": "left"
                },
                "quality_status": quality,
                "confidence": 0.98,
                "is_hypothetical": True,
                "idempotency_key": idempotency_key
            }

        elif dev_type == "pulse_oximeter":
            spo2 = float(raw_data.get("spo2", 98.0))
            pulse = float(raw_data.get("pulse", 74))
            return {
                "measurement_type": "pulse_oximetry",
                "value_numeric": spo2,
                "value_secondary": pulse,
                "value_text": f"{spo2}% SpO2",
                "unit": "%",
                "measurement_timestamp": meas_time,
                "source_type": "mock_device",
                "device_manufacturer": "Masimo (Simulated)",
                "device_model": "MightySat",
                "context_data": {
                    "perfusion_index": raw_data.get("perfusion_index", 2.5),
                    "signal_quality": raw_data.get("signal_quality", "HIGH")
                },
                "quality_status": "VALID" if spo2 >= 95.0 else "ALERT_HYPOXIA",
                "confidence": 0.99,
                "is_hypothetical": True,
                "idempotency_key": idempotency_key
            }

        elif dev_type == "glucose_meter":
            glu = float(raw_data.get("glucose_mg_dl", 92.0))
            ctx = raw_data.get("meal_context", "fasting")
            return {
                "measurement_type": "blood_glucose",
                "value_numeric": glu,
                "value_secondary": None,
                "value_text": f"{glu} mg/dL ({ctx})",
                "unit": "mg/dL",
                "measurement_timestamp": meas_time,
                "source_type": "mock_device",
                "device_manufacturer": "Dexcom (Simulated)",
                "device_model": "G7 CGM",
                "context_data": {
                    "meal_context": ctx,
                    "trend_arrow": raw_data.get("trend_arrow", "FLAT")
                },
                "quality_status": "VALID" if glu < 140.0 else "ALERT_ELEVATED",
                "confidence": 0.96,
                "is_hypothetical": True,
                "idempotency_key": idempotency_key
            }

        else:  # Wearable vitals
            hr = float(raw_data.get("resting_hr", 70))
            hrv = float(raw_data.get("hrv_rmssd_ms", 42.0))
            return {
                "measurement_type": "wearable_vitals",
                "value_numeric": hr,
                "value_secondary": hrv,
                "value_text": f"HR: {int(hr)} bpm | HRV: {hrv} ms",
                "unit": "bpm",
                "measurement_timestamp": meas_time,
                "source_type": "mock_device",
                "device_manufacturer": "Oura Health (Simulated)",
                "device_model": "Ring Gen 4",
                "context_data": {
                    "sleep_hours": raw_data.get("sleep_hours", 7.5),
                    "steps": raw_data.get("steps", 6500)
                },
                "quality_status": "VALID",
                "confidence": 0.95,
                "is_hypothetical": True,
                "idempotency_key": idempotency_key
            }


# =============================================================================
# FUTURE INTEGRATION SPECIFICATIONS (BLE, VENDOR CLOUD, HEALTH PLATFORMS)
# =============================================================================

class IntegrationSpecifications:
    """
    Documents architectural requirements and official protocols for future physical
    hardware integrations:
    - Path A: Direct Bluetooth / BLE
    - Path B: Manufacturer Cloud APIs
    - Path C: Phone Health Platforms (Apple HealthKit & Android Health Connect)
    """

    @staticmethod
    def get_all_specs() -> Dict[str, Any]:
        return {
            "path_a_direct_ble": {
                "name": "Direct Bluetooth Low Energy (BLE)",
                "status": "ADAPTER_INTERFACE_DEFINED (Ready for Web Bluetooth or Mobile Companion)",
                "supported_gatt_services": [
                    {"service_name": "Blood Pressure Service", "uuid": "0x1810", "characteristic_measurement": "0x2A35"},
                    {"service_name": "Pulse Oximeter Service", "uuid": "0x1822", "characteristic_plx_continuous": "0x2A5F"},
                    {"service_name": "Glucose Service", "uuid": "0x1808", "characteristic_measurement": "0x2A18"},
                    {"service_name": "Heart Rate Service", "uuid": "0x180D", "characteristic_measurement": "0x2A37"}
                ],
                "platform_compatibility": {
                    "chrome_edge_windows": "Supported via Web Bluetooth API (requires user pairing gesture)",
                    "safari_ios": "Requires Native Companion App wrapper (Web Bluetooth not supported by Apple Safari)",
                    "firefox": "Not supported natively"
                },
                "verification_status": "NOT_PHYSICALLY_VERIFIED (Simulated with MockDeviceConnector)"
            },
            "path_b_vendor_cloud_apis": {
                "name": "Manufacturer Cloud APIs",
                "status": "ADAPTER_INTERFACE_DEFINED",
                "supported_vendors": [
                    {
                        "vendor": "Withings Health API",
                        "auth": "OAuth 2.0 (Authorization Code + PKCE)",
                        "data_sync": "Webhooks + REST Polling /measure endpoint",
                        "devices": "BPM Connect, Body Cardio, ScanWatch"
                    },
                    {
                        "vendor": "Dexcom Developer API",
                        "auth": "OAuth 2.0",
                        "data_sync": "REST /v3/users/self/egvs (Estimated Glucose Values)",
                        "devices": "Dexcom G6 / G7 CGM"
                    },
                    {
                        "vendor": "Garmin Health API",
                        "auth": "OAuth 1.0a / 2.0 Enterprise",
                        "data_sync": "Push Architecture (Dailies, Epochs, PulseOx, Respiration)",
                        "devices": "Garmin Venu 3, Lily 2"
                    }
                ],
                "verification_status": "NOT_PHYSICALLY_VERIFIED (Vendor credentials required)"
            },
            "path_c_phone_health_platforms": {
                "name": "Phone Health Platforms",
                "status": "INGESTION_SCHEMA_PREPARED",
                "platforms": [
                    {
                        "platform": "Apple HealthKit (iOS)",
                        "bridge": "Swift Mobile Companion forwards authorized HKQuantityTypeSample to /api/v1/patients/{id}/measurements/batch",
                        "supported_types": ["HKQuantityTypeIdentifierBloodPressureSystolic", "HKQuantityTypeIdentifierBloodPressureDiastolic", "HKQuantityTypeIdentifierOxygenSaturation", "HKQuantityTypeIdentifierBloodGlucose"]
                    },
                    {
                        "platform": "Android Health Connect",
                        "bridge": "Kotlin Mobile Companion forwards authorized BloodPressureRecord and StepsRecord to /api/v1/patients/{id}/measurements/batch",
                        "supported_types": ["BloodPressureRecord", "OxygenSaturationRecord", "BloodGlucoseRecord", "HeartRateRecord"]
                    }
                ],
                "verification_status": "NOT_PHYSICALLY_VERIFIED (Requires mobile companion app build)"
            }
        }

mock_device_connector = MockDeviceConnector()
