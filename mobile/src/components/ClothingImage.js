import { useEffect, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { imageSource } from '../services/api';

// Les éléments <img> web ne transmettent pas les headers React Native :
// fetch authentifié puis URL blob privée, libérée au changement d'image/démontage.
export default function ClothingImage({ uri, style, accessibilityLabel = 'Photo du vêtement' }) {
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    let active = true;
    let blobUrl;
    setLoaded(null);
    (async () => {
      let source = await imageSource(uri);
      if (source?.headers && Platform.OS === 'web') {
        const response = await fetch(source.uri, { headers: source.headers, cache: 'no-store' });
        if (!response.ok) throw new Error('Image indisponible');
        blobUrl = URL.createObjectURL(await response.blob());
        if (!active) { URL.revokeObjectURL(blobUrl); return; }
        source = { uri: blobUrl };
      }
      if (active) setLoaded({ uri, source });
    })().catch(() => { if (active) setLoaded({ uri, source: null }); });
    return () => { active = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [uri]);
  const source = loaded?.uri === uri ? loaded.source : null;
  if (!source) return <View style={style} accessibilityLabel={accessibilityLabel}>
    <Text>Photo indisponible</Text>
  </View>;
  return <Image source={source} style={style} accessibilityLabel={accessibilityLabel}
    onError={() => setLoaded({ uri, source: null })} />;
}
