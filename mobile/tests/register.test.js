/* global jest, test, expect */
const { createScreenHarness, nodes, button } = require('./helpers/screenHarness');
test('l’inscription conserve le contrat API et bloque les doubles soumissions', async () => {
  let resolve;
  const registerUser = jest.fn(() => new Promise(done => { resolve = done; }));
  const navigation = { navigate: jest.fn() };
  const screen = createScreenHarness('register', { registerUser }, { navigation });
  for (const [label, value] of [['Prénom', 'Test'], ['Nom', 'Fictif'], ['Téléphone', '0000000000'], ['Ville', 'Ville test'],
    ['Code postal', '00000'], ['Adresse e-mail', 'test@example.invalid'], ['Mot de passe', 'fixture-only']]) {
    nodes(screen.render()).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label).props.onChangeText(value);
  }
  const submit = button(screen.render(), 'Créer le compte'); const pending = submit.props.onPress(); await submit.props.onPress();
  expect(registerUser).toHaveBeenCalledTimes(1);
  expect(registerUser).toHaveBeenCalledWith({ nom: 'Fictif', prenom: 'Test', telephone: '0000000000', ville: 'Ville test', code_postal: '00000', email: 'test@example.invalid', password: 'fixture-only' });
  resolve({}); await pending;
  screen.alert.mock.calls[0][2][0].onPress();
  expect(navigation.navigate).toHaveBeenCalledWith('Login');
});
