import unittest
from reboxe_ai.policy import Observation, VisualAssessment, review_result


class PolicyTests(unittest.TestCase):
    def result(self, assessment):
        return review_result(assessment, checksum="a" * 64, model_id="test", revision="b" * 40,
                             duration=10, timestamps=[0, 5])

    def test_visible_damage_never_executes_refund(self):
        result = self.result(VisualAssessment(assessment="VISIBLE_DAMAGE",
                              observations=[Observation(timestamp_seconds=5, description="Dent on outer box")]))
        self.assertEqual(result["recommendation"], "ADMIN_REVIEW")
        self.assertEqual(result["financialAction"], "NONE")
        self.assertFalse(result["calibrated"])

    def test_no_damage_never_rejects_claim(self):
        self.assertEqual(self.result(VisualAssessment(assessment="NO_CLEAR_DAMAGE"))["recommendation"], "ADMIN_REVIEW")

    def test_rejects_fabricated_timestamp(self):
        with self.assertRaises(ValueError):
            self.result(VisualAssessment(assessment="VISIBLE_DAMAGE",
                        observations=[Observation(timestamp_seconds=7, description="Damage")]))
