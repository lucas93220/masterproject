"""Reproduit le visuel C4 à partir des seules mesures synthétiques publiées.

Outil documentaire facultatif : Python + matplotlib, déjà présent sur le Mac d'analyse.
"""
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory


def main():
    root = Path(__file__).resolve().parent
    report = json.loads((root / 'benchmark_stockage_synthetique.json').read_text())
    if report['source'] != 'SYNTHETIC_ISOLATED_POSTGRESQL':
        raise ValueError('La source attendue est le benchmark fictif isolé')
    with TemporaryDirectory(prefix='fits-chart-') as config:
        os.environ['MPLCONFIGDIR'] = config
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt

        cases = report['cases']
        fig, axes = plt.subplots(1, 2, figsize=(11, 4.6), constrained_layout=True)
        x = list(range(len(cases)))
        for offset, key, title, color in [(-.18, 'before', 'Sans index supplémentaire', '#446084'),
                                          (.18, 'after', 'Index sur id_utilisateur', '#15826b')]:
            values = [case[key]['median_ms'] for case in cases]
            bars = axes[0].bar([i + offset for i in x], values, .34, label=title, color=color)
            axes[0].bar_label(bars, labels=[f'{v:.3f}' for v in values], padding=3, fontsize=8)
        axes[0].set_ylabel('Temps SQL médian (ms) — plus bas = mieux')
        axes[0].legend(fontsize=8)
        axes[0].set_ylim(0, max(case['before']['max_ms'] for case in cases) * 1.25)
        memory = [case['index_bytes'] / 1024 for case in cases]
        bars = axes[1].bar(x, memory, .55, color='#ac7845')
        axes[1].bar_label(bars, labels=[f'{v:.0f} Kio' for v in memory], padding=3)
        axes[1].set_ylabel('Stockage supplémentaire de l’index (Kio)')
        axes[1].set_ylim(0, max(memory) * 1.2)
        for ax in axes:
            ax.set_xticks(x, [f"{case['outfits']:,}".replace(',', ' ') for case in cases])
            ax.set_xlabel('Nombre de tenues fictives')
            ax.spines[['top', 'right']].set_visible(False)
        fig.suptitle('C4 — Benchmark PostgreSQL isolé, données synthétiques', fontweight='bold')
        fig.supxlabel('100 comptes uniformes • 9 répétitions, cache chauffé • hors API/ML • aucun index déployé', fontsize=9)
        fig.savefig(root / 'visuels/stockage_synthetique.svg', metadata={'Date': None})
        plt.close(fig)


if __name__ == '__main__':
    main()
