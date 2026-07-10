from django.test import TestCase

from .ollama_client import OllamaGenerationError, _parse_analysis_response


class ParseAnalysisResponseTests(TestCase):
    def test_envoyer_oui_is_parsed(self):
        content = "ENVOYER: OUI\nSUJET: Anomalie détectée\nCORPS:\nQuelque chose d'inhabituel."
        result = _parse_analysis_response(content, forcer_envoi=False)
        self.assertTrue(result["envoyer"])
        self.assertEqual(result["subject"], "Anomalie détectée")
        self.assertIn("inhabituel", result["body"])

    def test_envoyer_non_returns_false_when_not_forced(self):
        content = "ENVOYER: NON\nSUJET: Rien à signaler\nCORPS:\nTout est normal."
        result = _parse_analysis_response(content, forcer_envoi=False)
        self.assertFalse(result["envoyer"])

    def test_forcer_envoi_overrides_model_decision(self):
        content = "ENVOYER: NON\nSUJET: Rapport\nCORPS:\nRien de spécial mais rapport quand même."
        result = _parse_analysis_response(content, forcer_envoi=True)
        self.assertTrue(result["envoyer"])

    def test_envoyer_oui_with_empty_body_raises(self):
        content = "ENVOYER: OUI\nSUJET: Vide\nCORPS:\n"
        with self.assertRaises(OllamaGenerationError):
            _parse_analysis_response(content, forcer_envoi=False)

    def test_handles_space_before_colon(self):
        """Some models write 'LABEL :' (space before colon) — real observed output."""
        content = (
            "ENVOYER : NON\n\n"
            "SUJET : Liste de contrats avec dates d'échéance\n\n"
            "CORPS : La liste fournie semble contenir une série de contrats."
        )
        result = _parse_analysis_response(content, forcer_envoi=True)
        self.assertTrue(result["envoyer"])  # forced
        self.assertEqual(result["subject"], "Liste de contrats avec dates d'échéance")
        self.assertIn("série de contrats", result["body"])
