const postgres = require('../scripts/diagnosePostgres');
const mongo = require('../scripts/diagnoseMongo');

describe('diagnostics de données en lecture seule', () => {
  test('refuse toute cible PostgreSQL non locale ou signalée production', () => {
    expect(() => postgres.assertLocalDevelopment({
      DB_HOST: '127.0.0.1', DB_NAME: 'fits', NODE_ENV: 'development'
    })).not.toThrow();
    for (const env of [
      { DB_HOST: 'db.example.org', DB_NAME: 'fits' },
      { DB_HOST: 'localhost', DB_NAME: 'other' },
      { DB_HOST: 'localhost', DB_NAME: 'fits', NODE_ENV: 'production' }
    ]) expect(() => postgres.assertLocalDevelopment(env)).toThrow();
  });

  test('EXPLAIN refuse les écritures et résume les plans sans lignes métier', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ 'QUERY PLAN': [{
      'Execution Time': 0.12,
      Plan: { 'Node Type': 'Index Scan', 'Relation Name': 'evaluation',
        'Index Name': 'evaluation_pkey' }
    }] }] }) };
    await expect(postgres.explainRead(client, 'UPDATE evaluation SET is_liked = true', []))
      .rejects.toThrow('SELECT');
    const result = await postgres.explainRead(client,
      'SELECT id_tenue FROM evaluation WHERE id_utilisateur = $1', [9]);
    expect(client.query).toHaveBeenCalledTimes(5);
    expect(client.query.mock.calls.every(([sql]) => sql.startsWith('EXPLAIN') &&
      sql.includes('SELECT id_tenue'))).toBe(true);
    expect(result.execution_ms.median).toBe(0.12);
    expect(result.plan_nodes).toEqual([{ type: 'Index Scan', table: 'evaluation',
      index: 'evaluation_pkey' }]);
    expect(JSON.stringify(result)).not.toContain('9');
  });

  test('MongoDB exige la base fits et ne renvoie ni hôte ni identifiant', async () => {
    expect(mongo.assertTarget('mongodb+srv://example.org/fits', {}))
      .toEqual({ database: 'fits', remote: true });
    expect(() => mongo.assertTarget('mongodb://localhost/other', {})).toThrow();
    expect(() => mongo.assertTarget('mongodb://localhost/fits',
      { NODE_ENV: 'production' })).toThrow();

    const collection = { listIndexes: jest.fn().mockReturnValue({ toArray: async () => [
      { name: '_id_', key: { _id: 1 }, unique: true }
    ] }), findOne: jest.fn().mockResolvedValue({ _id: 'private-id' }) };
    const db = {
      listCollections: jest.fn().mockReturnValue({ toArray: async () =>
        [{ name: 'logs' }, { name: 'photos' }] }),
      command: jest.fn().mockImplementation(async ({ collStats }) => ({
        count: collStats === 'photos' ? 1 : 2, size: 100, storageSize: 1000,
        totalIndexSize: 200
      })),
      collection: jest.fn().mockReturnValue(collection)
    };
    const result = await mongo.inspect(db, { database: 'fits', remote: true });
    expect(result.collections).toHaveLength(2);
    expect(result.collections[1].indexes[0].unique).toBe(true);
    expect(result.collections[1].id_lookup_only_ms.repetitions).toBe(5);
    expect(collection.findOne).toHaveBeenCalledTimes(6);
    expect(collection.findOne.mock.calls.every(([, options]) =>
      options.projection._id === 1)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private-id');
  });
});
