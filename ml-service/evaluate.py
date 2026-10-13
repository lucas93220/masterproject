"""Évaluation hors ligne du Random Forest FITS, sans accès à l'API ni aux modèles Joblib."""

import argparse
import json
import math
import random
from collections import Counter
from pathlib import Path

import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import StratifiedGroupKFold, train_test_split


SEED = 42
MIN_ROWS = 50
MIN_PER_CLASS = 20
MIN_TEST_PER_CLASS = 5
BASE_FEATURES = {"temperature", "nb_vetements", "nb_favoris", "ratio_favoris"}
FEATURE_PREFIXES = ("zone_", "couleur_", "categorie_", "sous_categorie_", "association_")


def _validated_rows(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("feature_version"), str) \
            or not payload["feature_version"].startswith("outfit-v2-"):
        raise ValueError("feature_version outfit-v2 requis")
    rows = payload.get("data")
    if not isinstance(rows, list):
        raise ValueError("data doit être une liste")
    if not rows:
        return [], []
    if not all(isinstance(row, dict) for row in rows):
        raise ValueError("Chaque ligne doit être un objet")

    feature_names = [name for name in rows[0] if name not in {"id_tenue", "is_liked"}]
    if not BASE_FEATURES <= set(feature_names) or any(
            name not in BASE_FEATURES and not name.startswith(FEATURE_PREFIXES)
            for name in feature_names):
        raise ValueError("Features incompatibles avec outfit-v2")
    expected = set(feature_names) | {"id_tenue", "is_liked"}
    for row in rows:
        if set(row) != expected:
            raise ValueError("Les lignes n'ont pas les mêmes colonnes")
        if type(row["id_tenue"]) is not int or row["id_tenue"] <= 0:
            raise ValueError("id_tenue entier positif requis pour éviter la fuite de données")
        if type(row["is_liked"]) is not int or row["is_liked"] not in (0, 1):
            raise ValueError("is_liked doit valoir 0 ou 1")
        if any(type(row[name]) not in (int, float) or not math.isfinite(row[name])
               for name in feature_names):
            raise ValueError("Toutes les features doivent être numériques et finies")
    return rows, feature_names


def _scores(truth, prediction):
    matrix = confusion_matrix(truth, prediction, labels=[0, 1])
    return {
        "accuracy": float(accuracy_score(truth, prediction)),
        "precision": float(precision_score(truth, prediction, pos_label=1, zero_division=0)),
        "recall": float(recall_score(truth, prediction, pos_label=1, zero_division=0)),
        "f1": float(f1_score(truth, prediction, pos_label=1, zero_division=0)),
        "confusion_matrix": matrix.tolist(),
    }


def evaluate(payload):
    rows, feature_names = _validated_rows(payload)
    labels = [row["is_liked"] for row in rows]
    groups = [row["id_tenue"] for row in rows]
    counts = Counter(labels)
    report = {
        "status": "insufficient_data",
        "source": payload.get("source", "origine non vérifiée"),
        "feature_version": payload["feature_version"],
        "n_rows": len(rows),
        "n_outfits": len(set(groups)),
        "n_likes": counts[1],
        "n_dislikes": counts[0],
        "seed": SEED,
    }

    if not counts[0] or not counts[1]:
        report["reason"] = "Dataset vide ou classe unique"
        return report
    if len(rows) < MIN_ROWS or min(counts.values()) < MIN_PER_CLASS:
        report["reason"] = (f"Seuil exploratoire non atteint : {MIN_ROWS} avis et "
                            f"{MIN_PER_CLASS} par classe requis")
        return report

    indices = list(range(len(rows)))
    if len(set(groups)) == len(rows):
        candidates = [train_test_split(indices, test_size=0.25, random_state=SEED,
                                       stratify=labels)]
        method = "Séparation stratifiée 75/25 par avis (une tenue par avis)"
    else:
        group_counts = {label: len({groups[i] for i, value in enumerate(labels) if value == label})
                        for label in (0, 1)}
        if min(group_counts.values()) < 4:
            report["reason"] = "Moins de 4 tenues distinctes dans une classe"
            return report
        splitter = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=SEED)
        candidates = list(splitter.split(indices, labels, groups))
        method = "StratifiedGroupKFold à 4 plis, premier pli admissible en test ; groupes = id_tenue"

    selected = None
    for train_indices, test_indices in candidates:
        train_counts = Counter(labels[i] for i in train_indices)
        test_counts = Counter(labels[i] for i in test_indices)
        if min(train_counts[0], train_counts[1]) >= 5 and \
                min(test_counts[0], test_counts[1]) >= MIN_TEST_PER_CLASS:
            selected = (list(train_indices), list(test_indices), train_counts, test_counts)
            break
    if selected is None:
        report["reason"] = (f"Aucune séparation sans fuite avec au moins "
                            f"{MIN_TEST_PER_CLASS} avis de chaque classe en test")
        return report

    train_indices, test_indices, train_counts, test_counts = selected
    if set(groups[i] for i in train_indices) & set(groups[i] for i in test_indices):
        raise AssertionError("Fuite d'une même tenue entre entraînement et test")

    features = pd.DataFrame([{name: row[name] for name in feature_names} for row in rows],
                            columns=feature_names)
    x_train, x_test = features.iloc[train_indices], features.iloc[test_indices]
    y_train = [labels[i] for i in train_indices]
    y_test = [labels[i] for i in test_indices]
    model = RandomForestClassifier(random_state=SEED)  # mêmes paramètres que /train
    baseline = DummyClassifier(strategy="most_frequent")
    model.fit(x_train, y_train)
    baseline.fit(x_train, y_train)

    report.update({
        "status": "evaluated",
        "method": method,
        "n_train": len(train_indices),
        "n_test": len(test_indices),
        "train_likes": train_counts[1],
        "train_dislikes": train_counts[0],
        "test_likes": test_counts[1],
        "test_dislikes": test_counts[0],
        "train_outfits": len({groups[i] for i in train_indices}),
        "test_outfits": len({groups[i] for i in test_indices}),
        "model": _scores(y_test, model.predict(x_test)),
        "baseline": _scores(y_test, baseline.predict(x_test)),
    })
    return report


def synthetic_dataset():
    rng = random.Random(SEED)
    rows = []
    for outfit in range(1, 81):
        liked = int(outfit % 3 != 0)
        favorite = int(bool(liked) != (outfit % 7 == 0))
        temperature = 10 + outfit % 18
        for _ in range(2):  # avis répétés pour démontrer la séparation par tenue
            rows.append({
                "temperature": temperature,
                "nb_vetements": 2,
                "nb_favoris": favorite,
                "ratio_favoris": favorite / 2,
                "zone_torse": 1,
                "zone_jambes": 1,
                "couleur_bleu": int(outfit % 4 == 0),
                "categorie_00": 1,
                "sous_categorie_00": 1,
                "association_torse_jambes_meme_couleur": int(outfit % 5 == 0),
                "is_liked": liked,
                "id_tenue": outfit,
            })
    rng.shuffle(rows)
    return {"source": "SYNTHÉTIQUE — démonstration uniquement",
            "feature_version": "outfit-v2-synthetic-example", "data": rows}


def format_report(report):
    lines = [
        "# Évaluation hors ligne du Random Forest FITS",
        "",
        f"- Source : {report['source']}",
        f"- Version des features : {report['feature_version']}",
        f"- Dataset : {report['n_rows']} avis, {report['n_outfits']} tenues distinctes",
        f"- Répartition : {report['n_likes']} likes, {report['n_dislikes']} dislikes",
        f"- Graine aléatoire : {report['seed']}",
        "",
    ]
    if report["status"] != "evaluated":
        lines += ["## Résultat", "", "Métriques non calculées : " + report["reason"], ""]
    else:
        lines += [
            "## Méthodologie", "", report["method"],
            f"Entraînement : {report['n_train']} avis ({report['train_likes']} likes, "
            f"{report['train_dislikes']} dislikes), {report['train_outfits']} tenues.",
            f"Test : {report['n_test']} avis ({report['test_likes']} likes, "
            f"{report['test_dislikes']} dislikes), {report['test_outfits']} tenues.",
            "La baseline prédit toujours la classe majoritaire du seul ensemble d'entraînement.",
            "", "## Métriques sur le test", "",
            "| Modèle | Accuracy | Précision (like) | Rappel (like) | F1 (like) |",
            "|---|---:|---:|---:|---:|",
        ]
        for name, key in (("Random Forest", "model"), ("Classe majoritaire", "baseline")):
            score = report[key]
            lines.append(f"| {name} | {score['accuracy']:.3f} | {score['precision']:.3f} | "
                         f"{score['recall']:.3f} | {score['f1']:.3f} |")
        lines += ["", "Matrice de confusion (lignes = réel, colonnes = prédit ; ordre dislike, like) :", ""]
        for name, key in (("Random Forest", "model"), ("Baseline", "baseline")):
            matrix = report[key]["confusion_matrix"]
            lines.append(f"- {name} : [[{matrix[0][0]}, {matrix[0][1]}], "
                         f"[{matrix[1][0]}, {matrix[1][1]}]]")
        lines.append("")
    lines += [
        "## Limites", "",
        "Une seule séparation aléatoire : les scores varient avec l'échantillon. "
        "Les données d'utilisateurs différents ne doivent jamais être mélangées.",
        "Des tenues distinctes partageant les mêmes vêtements peuvent encore être corrélées. "
        "Les anciens avis sans snapshot peuvent refléter l'état actuel de la garde-robe.",
        "Les labels proviennent des appréciations observées et ne mesurent pas la satisfaction future. "
        "Ces métriques de classification ne mesurent pas directement la qualité du classement des tenues générées.",
    ]
    if "SYNTHÉTIQUE" in str(report["source"]).upper():
        lines.append("Données synthétiques : ces chiffres ne mesurent pas la performance réelle de FITS.")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path, help="Export JSON d'un seul utilisateur")
    source.add_argument("--synthetic", action="store_true", help="Données fictives déterministes")
    args = parser.parse_args()
    payload = synthetic_dataset() if args.synthetic else json.loads(args.input.read_text(encoding="utf-8"))
    try:
        print(format_report(evaluate(payload)), end="")
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
