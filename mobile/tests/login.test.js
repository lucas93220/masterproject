/* global __dirname, jest, describe, test, expect */
const { createScreenHarness, button } = require('./helpers/screenHarness');
function createScreen(loginUser) {
  const setItem = jest.fn().mockResolvedValue();
  const replace = jest.fn();
  const screen = createScreenHarness('login', { loginUser }, { storage: { setItem }, navigation: { replace, navigate: jest.fn() } });
  return { pressLogin: () => button(screen.render(), 'Se connecter').props.onPress(), alert: screen.alert, setItem, replace };
}

describe('Retour de connexion mobile', () => {
  test('conserve le message générique pour des identifiants refusés', async () => {
    const screen = createScreen(jest.fn().mockRejectedValue(new Error('Email ou mot de passe incorrect')));
    await screen.pressLogin();
    expect(screen.alert).toHaveBeenCalledWith('Erreur de connexion', 'Email ou mot de passe incorrect');
    expect(screen.replace).not.toHaveBeenCalled();
  });

  test('explique une panne réseau au lieu d’accuser le mot de passe', async () => {
    const screen = createScreen(jest.fn().mockRejectedValue(new Error('Network request failed')));
    await screen.pressLogin();
    expect(screen.alert).toHaveBeenCalledWith('Erreur de connexion',
      "Impossible de joindre le serveur. Vérifie le réseau et l'adresse de l'API.");
    expect(screen.replace).not.toHaveBeenCalled();
  });

  test('ne masque pas une erreur temporaire du backend', async () => {
    const screen = createScreen(jest.fn().mockRejectedValue(new Error('Service temporairement indisponible')));
    await screen.pressLogin();
    expect(screen.alert).toHaveBeenCalledWith('Erreur de connexion', 'Service temporairement indisponible');
  });

  test('préserve la connexion lorsque la réponse est valide', async () => {
    const screen = createScreen(jest.fn().mockResolvedValue({ token: 'jeton-fictif' }));
    await screen.pressLogin();
    expect(screen.setItem).toHaveBeenCalledWith('token', 'jeton-fictif');
    expect(screen.replace).toHaveBeenCalledWith('Main');
  });
});

test('le bouton de visibilité ne modifie pas la valeur du mot de passe', () => {
  const { nodes } = require('./helpers/screenHarness');
  const screen = createScreenHarness('login', {});
  const input = () => nodes(screen.render()).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === 'Mot de passe');
  input().props.onChangeText('fictif');
  expect(input().props.secureTextEntry).toBe(true);
  button(screen.render(), 'Afficher le mot de passe').props.onPress();
  expect(input().props.secureTextEntry).toBe(false); expect(input().props.value).toBe('fictif');
  button(screen.render(), 'Masquer le mot de passe').props.onPress();
  expect(input().props.secureTextEntry).toBe(true);
});
