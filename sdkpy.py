import logging
import sys

# 1. Enable live console logging output
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

print(">>> Initializing Sentinel AI SDK from PyPI...")

from sentinelai_sdk import SentinelAISDKClient

# 2. Initialize SDK pointing to Cloud Run backend
client = SentinelAISDKClient(
    api_key="obs_production_3bdcbd29608e46a5042d712afa17602458902d1829a1315d",
    service_name="test-service",
    environment="production"
)

# 3. Capture test signals
print(">>> Capturing telemetry signals (logs, metrics, traces)...")
client.capture_log("INFO", "Telemetry triggered from Python test runner")
client.capture_metric("payment_latency_ms", 124.5)
client.capture_trace(
    trace_id="tr_9901",
    span_id="sp_1102",
    operation_name="POST /checkout",
    duration_ms=124.5,
    status_code=200
)

# 4. Flush telemetry to Cloud Run
print(">>> Flushing telemetry batch to Cloud Run...")
success = client.flush()

print(f"\n==========================================")
print(f"✅ Ingestion Batch Sent Successfully: {success}")
print(f"==========================================")
