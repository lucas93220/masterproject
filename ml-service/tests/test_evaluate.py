import unittest

from evaluate import evaluate, format_report, synthetic_dataset


def dataset(likes=30, dislikes=30):
    rows = []
    for index in range(likes + dislikes):
        label = int(index < likes)
        rows.append({
            "temperature": 18 + index % 4,
            "nb_vetements": 2,
            "nb_favoris": label,
            "ratio_favoris": label / 2,
            "zone_torse": 1,
            "couleur_bleu": label,
            "categorie_00": 1,
            "sous_categorie_00": 1,
            "association_torse_jambes_meme_couleur": 0,
            "is_liked": label,
            "id_tenue": index + 1,
        })
    return {"feature_version": "outfit-v2-test", "source": "test fictif", "data": rows}


class EvaluationTests(unittest.TestCase):
    def test_synthetic_report_is_reproducible_and_explicit(self):
        first = evaluate(synthetic_dataset())
        second = evaluate(synthetic_dataset())
        self.assertEqual(first, second)
        self.assertEqual(first["status"], "evaluated")
        self.assertEqual(first["n_rows"], 160)
        self.assertEqual(first["n_outfits"], 80)
        self.assertEqual(first["train_outfits"] + first["test_outfits"], 80)
        self.assertIn("StratifiedGroupKFold", first["method"])
        self.assertIn("ne mesurent pas la performance réelle", format_report(first))
        self.assertEqual(sum(map(sum, first["model"]["confusion_matrix"])), first["n_test"])

    def test_unique_outfits_use_stratified_split_and_training_majority_baseline(self):
        result = evaluate(dataset(40, 20))
        self.assertEqual(result["status"], "evaluated")
        self.assertIn("Séparation stratifiée", result["method"])
        self.assertEqual(result["baseline"]["confusion_matrix"], [[0, 5], [0, 10]])
        self.assertEqual(result["n_train"] + result["n_test"], 60)

    def test_insufficient_and_single_class_have_no_metrics(self):
        for payload in (dataset(10, 10), dataset(60, 0),
                        {"feature_version": "outfit-v2-test", "data": []}):
            with self.subTest(n=len(payload["data"])):
                result = evaluate(payload)
                self.assertEqual(result["status"], "insufficient_data")
                self.assertNotIn("model", result)
                self.assertIn("Métriques non calculées", format_report(result))

    def test_repeated_outfit_without_enough_independent_groups_is_rejected(self):
        payload = dataset(30, 30)
        for row in payload["data"]:
            row["id_tenue"] = 1 if row["is_liked"] else 2
        result = evaluate(payload)
        self.assertEqual(result["status"], "insufficient_data")
        self.assertIn("tenues distinctes", result["reason"])

    def test_invalid_group_label_and_feature_schema_are_rejected(self):
        for changed in ({"id_tenue": None}, {"is_liked": True}, {"id_utilisateur": 2},
                        {"temperature": float("nan")}):
            with self.subTest(changed=changed):
                payload = dataset()
                payload["data"][0].update(changed)
                with self.assertRaises(ValueError):
                    evaluate(payload)


if __name__ == "__main__":
    unittest.main()
