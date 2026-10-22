import hashlib
import io
import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from PIL import Image
from reboxe_ai.app import app
from reboxe_ai.policy import Observation, VisualAssessment


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.token = "synthetic-service-token-at-least-32-characters"
        self.environment = patch.dict(os.environ, {"AI_SERVICE_TOKEN": self.token})
        self.environment.start()
        self.client = TestClient(app)
        image = io.BytesIO()
        Image.new("RGB", (64, 64), "white").save(image, format="PNG")
        self.data = image.getvalue()

    def tearDown(self):
        self.environment.stop()
        self.client.close()

    def post(self, checksum=None, headers=None):
        return self.client.post("/v1/triage", files={"file": ("evidence.png", self.data, "image/png")},
                                data={"checksum": checksum or hashlib.sha256(self.data).hexdigest()},
                                headers=headers if headers is not None else {"Authorization": f"Bearer {self.token}"})

    def test_requires_service_authentication(self):
        self.assertEqual(self.post(headers={}).status_code, 401)

    def test_rejects_changed_evidence_before_inference(self):
        with patch("reboxe_ai.model.assess") as infer:
            self.assertEqual(self.post(checksum="0" * 64).status_code, 422)
            infer.assert_not_called()

    def test_validated_image_returns_advisory_report(self):
        result = VisualAssessment(assessment="VISIBLE_DAMAGE", observations=[Observation(timestamp_seconds=0, description="Visible dent")])
        with patch("reboxe_ai.model.assess", return_value=result):
            response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["financialAction"], "NONE")
        self.assertEqual(response.json()["evidenceChecksum"], hashlib.sha256(self.data).hexdigest())

    def test_model_failure_keeps_human_review_available(self):
        with patch("reboxe_ai.model.assess", side_effect=RuntimeError("secret internals")):
            response = self.post()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("secret internals", response.text)

    def test_media_inspection_does_not_load_a_model(self):
        with patch("reboxe_ai.model.assess") as infer:
            response = self.client.post("/v1/media/inspect", files={"file": ("evidence.png", self.data, "image/png")},
                data={"checksum": hashlib.sha256(self.data).hexdigest()}, headers={"Authorization": f"Bearer {self.token}"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["durationSeconds"], 0)
            infer.assert_not_called()
