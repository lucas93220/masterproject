import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getBrandCatalogue } from '../services/api';
import { brandOptions, customBrandAllowed, normalizeBrand } from '../services/brandSearch';
import { Button, Field, Notice, Sheet, layout } from './ui';
import { COLORS } from '../styles/colors';
import { TYPE } from '../styles/theme';

export default function BrandSelect({ value, onChange, disabled = false }) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [personalAvailable, setPersonalAvailable] = useState(true);
  const [unbranded, setUnbranded] = useState(false);
  const cache = useRef(null);
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);

  const close = () => { request.current += 1; setVisible(false); setLoading(false); };
  const choose = name => {
    if (disabled) return;
    setUnbranded(!name); onChange(name); close();
  };
  const load = async () => {
    const token = ++request.current;
    setLoading(true); setError(null);
    try {
      const data = await getBrandCatalogue();
      if (token !== request.current) return;
      if (!Array.isArray(data?.brands)) throw new Error('Catalogue invalide');
      const brands = data.brands.filter(brand => typeof brand?.name === 'string')
        .map(brand => ({ ...brand, aliases: Array.isArray(brand.aliases) ?
          brand.aliases.filter(alias => typeof alias === 'string') : [] }));
      setCatalog(brands); setPersonalAvailable(data.personalAvailable !== false);
      // Réessayer les marques personnelles à la prochaine ouverture si la base était indisponible.
      cache.current = data.personalAvailable === false ? null : brands;
    } catch {
      if (token === request.current) setError('Impossible de charger les marques. Tu peux réessayer ou saisir la marque recherchée.');
    } finally { if (token === request.current) setLoading(false); }
  };
  const open = () => {
    if (disabled) return;
    setQuery(''); setError(null); setVisible(true);
    if (!cache.current) void load();
  };
  const options = brandOptions(catalog, value, query);
  const custom = query.trim().replace(/\s+/g, ' ');
  const canUseCustom = !loading && customBrandAllowed(catalog, value, custom);

  return <>
    <View style={{ gap: 8 }}>
      <Text style={{ ...TYPE.caption, fontWeight: '600', color: COLORS.text }}>Marque</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choisir une marque"
        accessibilityValue={{ text: value || (unbranded ? 'Sans marque' : 'Non renseignée') }}
        accessibilityState={{ disabled }} disabled={disabled} onPress={open}
        style={[layout.input, layout.between, { flex: 0 }, disabled && { opacity: 0.6 }]}>
        <Text style={[TYPE.body, { flex: 1 }]}>{value || (unbranded ? 'Sans marque' : 'Choisir une marque (facultatif)')}</Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
      </TouchableOpacity>
    </View>
    <Sheet visible={visible} title="Choisir une marque" subtitle="Recherche une marque ou retrouve celles de ton dressing."
      onClose={close} keyboard header={<Field label="Rechercher une marque" placeholder="Ex. Nike, Levi’s, Uniqlo…"
        value={query} onChangeText={setQuery} maxLength={100} autoCorrect={false} autoCapitalize="none" />}>
      {loading ? <ActivityIndicator color={COLORS.primary} /> : null}
      {error ? <View style={{ gap: 12 }}><Notice error message={error} />
        <Button title="Réessayer les marques" variant="secondary" onPress={load} /></View> : null}
      {!personalAvailable ? <Text style={TYPE.caption}>Le catalogue commun reste disponible ; tes marques personnelles n’ont pas pu être chargées.</Text> : null}
      {options.length > 0 ? <Text style={layout.sectionLabel}>{query.trim() ? `${options.length} résultat${options.length > 1 ? 's' : ''}` : 'TES MARQUES ET LE CATALOGUE FITS'}</Text> : null}
      {options.map(brand => {
        const selected = normalizeBrand(value) && [brand.name, ...(brand.aliases || [])]
          .some(name => normalizeBrand(name) === normalizeBrand(value));
        return <TouchableOpacity key={brand.name} accessibilityRole="button"
          accessibilityLabel={`Sélectionner la marque ${brand.name}`} accessibilityState={{ selected: !!selected }}
          onPress={() => choose(brand.name)} style={[layout.between, { minHeight: 52, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: COLORS.border }]}>
          <Text style={[TYPE.body, { flex: 1 }]}>{brand.name}</Text>
          <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? COLORS.primary : COLORS.border} />
        </TouchableOpacity>;
      })}
      {!loading && !options.length && !error ? <Text style={TYPE.caption}>Aucune marque trouvée dans le catalogue.</Text> : null}
      {canUseCustom ? <View style={{ gap: 8 }}>
        <Button title={`Utiliser « ${custom} »`} variant="secondary" icon="add-outline" onPress={() => choose(custom)} />
        <Text style={TYPE.caption}>Cette marque sera réutilisable dans tes prochaines saisies une fois le vêtement enregistré.</Text>
      </View> : null}
      <Button title="Sans marque" variant="secondary" onPress={() => choose('')} />
    </Sheet>
  </>;
}
