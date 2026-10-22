/* global jest, test, expect */
const { createScreenHarness, nodes, text, button, flush } = require('./helpers/screenHarness');
test('un échec de lecture du profil bloque la sauvegarde des champs vides et permet la reprise', async () => {
  const api = { getProfile: jest.fn().mockRejectedValueOnce(new Error('Hors ligne')).mockResolvedValue({ nom: 'Test', ville: 'Lyon' }), updateProfile: jest.fn() };
  const screen = createScreenHarness('profile', api);
  screen.render(); screen.effects.forEach(effect => effect()); await flush();
  expect(text(screen.render())).toContain('Profil indisponible');
  expect(button(screen.render(), 'Enregistrer')).toBeUndefined();
  await button(screen.render(), 'Réessayer').props.onPress();
  expect(nodes(screen.render()).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === 'Ville').props.value).toBe('Lyon');
  expect(api.updateProfile).not.toHaveBeenCalled();
});
test('la sauvegarde conserve le contrat et bloque les clics multiples et la suppression simultanée', async () => {
  let resolve;
  const api = { getProfile: jest.fn().mockResolvedValue({ nom: 'Test', prenom: 'Démo', ville: 'Lyon', code_postal: '69000' }),
    updateProfile: jest.fn().mockImplementation(() => new Promise(done => { resolve = done; })), deleteMyAccount: jest.fn() };
  const screen = createScreenHarness('profile', api);
  screen.render(); screen.effects.forEach(effect => effect()); await flush();
  const tree = screen.render(); const save = button(tree, 'Enregistrer');
  const pending = save.props.onPress(); await save.props.onPress();
  button(tree, 'Supprimer mon compte').props.onPress();
  expect(api.updateProfile).toHaveBeenCalledTimes(1);
  expect(api.updateProfile).toHaveBeenCalledWith({ nom: 'Test', prenom: 'Démo', ville: 'Lyon' });
  expect(screen.alert).not.toHaveBeenCalled(); expect(api.deleteMyAccount).not.toHaveBeenCalled();
  resolve({}); await pending;
  expect(screen.alert).toHaveBeenCalledWith('Succès', 'Profil mis à jour');
});
