const { reportProspective } = require('../scripts/reportProspectivePredictions');

test('compare uniquement les prédictions personnalisées consignées avant le vote', () => {
  const votes = [
    { id_tenue: 1, is_liked: false, date_avis: '2026-01-01T09:00:00Z' },
    { id_tenue: 2, is_liked: false, date_avis: '2026-01-01T09:01:00Z' },
    { id_tenue: 3, is_liked: true, temperature: 18, date_avis: '2026-01-01T10:01:00Z' },
    { id_tenue: 4, is_liked: false, temperature: 18, date_avis: '2026-01-01T10:03:00Z' },
    { id_tenue: 5, is_liked: true, date_avis: '2026-01-01T10:05:00Z' }
  ];
  const trace = (id, probability, date, model = 'personalized') => ({
    date, details: { id_tenue: id, probability_like: probability, model_used: model }
  });
  const traces = [
    trace(3, 0.8, '2026-01-01T10:00:00Z'),
    trace(4, 0.7, '2026-01-01T10:02:00Z'),
    trace(5, 0.9, '2026-01-01T10:06:00Z'), // après le vote : exclu
    trace(6, 0.4, '2026-01-01T10:07:00Z'), // pas encore voté
    trace(2, 0.2, '2026-01-01T08:00:00Z', 'fallback')
  ];
  const report = reportProspective(traces, votes);
  expect(report).toMatchObject({ recorded: 5, personalized: 4, fallback: 1,
    missing_vote: 1, invalid_or_late: 1, evaluated: 2,
    likes: 1, dislikes: 1, correct_model: 1, correct_prior_majority: 1,
    accuracy_model: 0.5, accuracy_prior_majority: 0.5,
    confusion: { true_dislikes: 0, false_likes: 1, false_dislikes: 0, true_likes: 1 } });
  expect(report.brier).toBeCloseTo((0.2 ** 2 + 0.7 ** 2) / 2);
  expect(report.by_temperature).toEqual({ '18': { n: 2, likes: 1,
    correct_model: 1, correct_prior_majority: 1 } });
  expect(report.probability_bands.map(band => [band.n, band.likes])).toEqual([
    [0, 0], [0, 0], [0, 0], [1, 0], [1, 1]
  ]);
});

test('aucune prédiction admissible ne produit de métrique inventée', () => {
  const report = reportProspective([], []);
  expect(report.evaluated).toBe(0);
  expect(report.brier).toBeNull();
  expect(report).not.toHaveProperty('accuracy_model');
});
