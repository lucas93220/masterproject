/* eslint-env node */
/* global require, process, Buffer, __dirname, WebSocket, fetch, setTimeout, URL, Response, window, document, requestAnimationFrame */
// Parcours visuel sur un export web, avec API fictive et profil Chrome temporaire.
// Aucune requête ne peut atteindre les services FITS ; aucune dépendance ajoutée.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || '/private/tmp/fits-ui-web');
const chromePath = process.env.FITS_TEST_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fits-ui-smoke-'));
let chrome, socket, server;

function fixtures() {
  const original = window.fetch.bind(window);
  const picture = color => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360" viewBox="0 0 300 360"><rect width="300" height="360" fill="#EDEEE8"/><path d="M95 60L45 95L20 157L68 179L85 145L85 300L215 300L215 145L232 179L280 157L255 95L205 60L175 77L125 77Z" fill="${color}" stroke="#404D43" stroke-width="2"/><path d="M125 77Q150 114 175 77" fill="none" stroke="#404D43" stroke-width="3"/></svg>`);
  const pieces = [
    ['Chemise en lin', 'Atelier', 'blanc', '#FDFBF4', false, 1],
    ['Veste de saison', 'Studio', 'vert', '#668577', true, 1],
    ['Jean droit', 'Atelier', 'bleu', '#5F7796', false, 1],
    ['Baskets claires', 'Studio', 'beige', '#D6C8AE', true, 2],
    ['Casquette', 'Studio', 'noir', '#30342F', false, 3],
    ['Pull léger', 'Atelier', 'marron', '#9A7459', false, 1]
  ].map(([nom, marque, couleur, hex, favori, cat], index) => ({ id_vetement: index + 1, nom, marque, couleur, favori,
    photo: picture(hex), id_sous_categorie: cat, temperature_min: 0, temperature_max: 25,
    sous_categorie: { id_categorie: cat, nom_sous_categorie: cat === 1 ? 'Hauts' : cat === 2 ? 'Baskets' : 'Casquettes' } }));
  const categories = [{ id_categorie: 1, nom_categorie: 'Vêtements' }, { id_categorie: 2, nom_categorie: 'Chaussures' }, { id_categorie: 3, nom_categorie: 'Accessoires' }];
  window.__fitsRequests = [];
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    if (url.pathname.startsWith('/api/')) {
      window.__fitsRequests.push({ path: url.pathname, method: options.method || 'GET', body: options.body });
      let value;
      if (url.pathname === '/api/auth/login') value = { token: 'fixture-only' };
      else if (url.pathname === '/api/meteo/me') value = { ville: 'Ville de démo', temperature: 13.43, icon: '02d', description: 'Quelques nuages' };
      else if (url.pathname === '/api/dressing/me') value = { vetements: pieces };
      else if (url.pathname === '/api/categorie') value = categories;
      else if (url.pathname === '/api/brands') value = { brands: [
        { name: 'Nike', aliases: [], popular: true }, { name: "Levi's", aliases: ['Levis'], popular: true }
      ], personalAvailable: true };
      else if (url.pathname.startsWith('/api/sous-categorie/')) value = [{ id_sous_categorie: 1, nom_sous_categorie: 'Hauts' }];
      else if (url.pathname === '/api/utilisateur/me') value = { prenom: 'Démo', nom: 'FITS', ville: 'Ville de démo', code_postal: '00000' };
      else if (url.pathname === '/api/tenue/generate') value = { id_tenue: 42, vetements: pieces.slice(0, 4) };
      else if (url.pathname === '/api/evaluation') value = {};
      else throw new Error('Appel API inattendu : ' + url.pathname);
      return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.origin === window.location.origin || url.protocol === 'data:' || url.protocol === 'blob:') return original(input, options);
    throw new Error('Réseau externe bloqué pour cet essai : ' + url.origin);
  };
}

(async () => {
  assert.ok(fs.existsSync(path.join(root, 'index.html')), 'Exporter le web avant ce test');
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404).end(); return; }
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.ttf': 'font/ttf', '.png': 'image/png' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(data);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--remote-debugging-port=0',
    `--user-data-dir=${path.join(temp, 'chrome')}`, 'about:blank'], { stdio: 'ignore' });
  let startupError;
  chrome.on('error', err => { startupError = err; });
  const portFile = path.join(temp, 'chrome/DevToolsActivePort');
  for (let n = 0; !fs.existsSync(portFile) && n < 100; n++) { if (startupError) throw startupError; await delay(100); }
  const debugPort = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const page = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const waiting = new Map(), errors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = waiting.get(message.id); waiting.delete(message.id);
      if (message.error) callback?.reject(new Error(JSON.stringify(message.error))); else callback?.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const current = ++id; waiting.set(current, { resolve, reject }); socket.send(JSON.stringify({ id: current, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Erreur navigateur');
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let n = 0; n < 100; n++) { if (await evaluate(expression)) return; await delay(50); }
    throw new Error('Élément introuvable : ' + expression);
  };
  const click = async label => {
    const expression = `Array.from(document.querySelectorAll('button, [role="button"], [role="tab"], [role="link"], a')).find(el => el.getAttribute('aria-label') === ${JSON.stringify(label)} || el.textContent === ${JSON.stringify(label)} || ((el.getAttribute('role') === 'tab' || el.tagName === 'A') && el.textContent.endsWith(${JSON.stringify(label)})))`;
    await waitFor(`!!(${expression})`); await evaluate(`(${expression}).scrollIntoView({ block: 'center' }); (${expression}).click()`); await delay(200);
  };
  const backToDressing = async () => {
    const label = await evaluate(`Array.from(document.querySelectorAll('button, [role="button"], [role="link"], a')).find(el => /back|retour|DressingMain/i.test(el.getAttribute('aria-label') || ''))?.getAttribute('aria-label')`);
    assert.ok(label, 'Le formulaire doit garder une flèche de retour vers la collection');
    await click(label);
    await waitFor(`document.querySelector('[aria-label="Rechercher dans mon dressing"]')?.getBoundingClientRect().width > 0`);
  };
  const screenshot = async name => {
    await delay(250);
    const result = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(temp, name + '.png'), Buffer.from(result.data, 'base64'));
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixtures.toString()})()` });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  await waitFor(`document.body.innerText.includes('Heureux de te retrouver.')`);
  await screenshot('connexion');
  await click('Se connecter');
  await waitFor(`document.body.innerText.includes('Ville de démo')`);
  await screenshot('accueil-vide');
  // Tester ce raccourci AVANT toute visite du dressing : il doit conserver la liste dans la pile.
  await click('Compléter mon dressing'); await screenshot('raccourci-ajouter');
  await backToDressing(); await click('Aujourd’hui');
  await click('Générer ma tenue');
  await waitFor(`document.body.innerText.includes('Chemise en lin')`);
  await screenshot('accueil-tenue');
  await click('Voir Chemise en lin'); await screenshot('photo'); await click('Fermer');
  await click('Je n’aime pas cette tenue, en proposer une autre');
  const calls = await evaluate(`window.__fitsRequests.filter(r => /evaluation|generate/.test(r.path))`);
  assert.equal(calls[1].path, '/api/evaluation'); assert.equal(JSON.parse(calls[1].body).is_liked, false);
  assert.equal(calls[2].path, '/api/tenue/generate');
  await click('Dressing'); await waitFor(`document.body.innerText.includes('Veste de saison')`);
  await screenshot('dressing'); await click('Filtres'); await screenshot('filtres');
  await click('bleu'); await click('Voir 1 pièce');
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Modifier Jean droit"]')`), true);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Modifier Chemise en lin"]')`), false);
  await click('Modifier Jean droit'); await waitFor(`document.body.innerText.includes('Ta pièce, en détail.')`);
  await screenshot('modifier');
  // Le retour de pile est un bouton au libellé issu de React Navigation.
  const back = await evaluate(`Array.from(document.querySelectorAll('button, [role="button"], [role="link"], a')).find(el => /back|retour|DressingMain/i.test(el.getAttribute('aria-label') || ''))?.getAttribute('aria-label')`);
  if (!back) throw new Error('Retour de navigation introuvable : ' + await evaluate(`JSON.stringify(Array.from(document.querySelectorAll('button, [role="button"], a')).map(el => ({ label: el.getAttribute('aria-label'), text: el.textContent })))`));
  await click(back); await click('Ajouter un vêtement'); await screenshot('ajouter');
  await click('Choisir une marque'); await click('Sélectionner la marque Nike');
  await click('Choisir une marque');
  await evaluate(`(() => {
    const input = document.querySelector('[aria-label="Rechercher une marque"]');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'levis');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  })()`);
  await waitFor(`Array.from(document.querySelectorAll('[aria-label]')).some(el => el.getAttribute('aria-label') === ${JSON.stringify("Sélectionner la marque Levi's")}) && !document.querySelector('[aria-label="Sélectionner la marque Nike"]')`);
  await screenshot('marques'); await click("Sélectionner la marque Levi's");
  assert.equal(await evaluate(`window.__fitsRequests.filter(r => r.path === '/api/brands').length`), 1);
  await click('Choisir une catégorie'); await click('Choisir Vêtements'); await screenshot('categories'); await click('Choisir Hauts');
  await click('Profil'); await waitFor(`document.body.innerText.includes('À ton image.')`); await screenshot('profil');
  // Une fiche conservée lors du changement d'onglet doit toujours permettre le retour à la liste.
  await click('Dressing'); await screenshot('retour-dressing');
  await backToDressing();
  await click('Tout');
  await waitFor(`!!document.querySelector('[aria-label="Modifier Chemise en lin"]')`);
  await click('Modifier Veste de saison');
  await waitFor(`document.body.innerText.includes('Ta pièce, en détail.')`);
  await click('Profil'); await click('Dressing');
  await backToDressing();
  await click('Profil');
  for (const width of [390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(150);
    const tabsFit = await evaluate(`document.querySelectorAll('[role="tab"]').length === 3 && Array.from(document.querySelectorAll('[role="tab"]')).every(el => {
      const label = el.lastElementChild?.getBoundingClientRect(); const box = el.getBoundingClientRect();
      return label && label.bottom <= box.bottom + 1 && label.right <= box.right + 1 && label.bottom <= window.innerHeight;
    })`);
    assert.ok(tabsFit, 'Libellés de navigation visibles à ' + width + ' px');
    if (width === 320) await screenshot('profil-320');
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'ok', parcours: ['connexion', 'accueil', 'avis', 'photo', 'dressing', 'filtres', 'modification', 'ajout', 'marques', 'catégories', 'retour-dressing', 'profil'], screenshots: temp, browserErrors: errors.length }));
})().catch(error => { console.error(error.message); console.error('Captures : ' + temp); process.exitCode = 1; }).finally(async () => {
  socket?.close();
  if (chrome) {
    const stopped = new Promise(resolve => chrome.once('exit', resolve));
    chrome.kill(); await Promise.race([stopped, delay(3000)]);
  }
  server?.close();
  fs.rmSync(path.join(temp, 'chrome'), { recursive: true, force: true });
});
