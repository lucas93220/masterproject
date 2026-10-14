const errorHandler = require('../utils/errorHandler');
test('les erreurs internes ne diffusent ni secret, URL ni données SQL dans les logs/réponses', () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(new Error('Authorization: secret-fictif sql=SELECT password'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toMatch(/secret-fictif|SELECT|password/);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret-fictif|SELECT|password/);
  } finally { log.mockRestore(); }
});
