import { View, Text, TextInput, FlatList, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { getMyDressing, deleteClothing, toggleFavorite, getCategories } from "../services/api";
import { filterWardrobe } from "../services/wardrobeView";
import ClothingImage from "../components/ClothingImage";
import { Screen, Heading, Button, IconButton, Chip, Sheet, EmptyState, Notice, layout } from "../components/ui";
import { COLORS } from "../styles/colors";
import { CLOTHING_COLORS } from "../styles/clothingPalette";
import { TYPE } from "../styles/theme";

export default function Dressing({ navigation }) {
  const [dressing, setDressing] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(null);
  const [favorites, setFavorites] = useState(false);
  const [color, setColor] = useState(null);
  const [sort, setSort] = useState("favorites");
  const [filterModal, setFilterModal] = useState(false);
  const [pendingIds, setPendingIds] = useState([]);
  const pending = useRef(new Set());
  const loadVersion = useRef(0);

  const loadDressing = async () => {
    if (pending.current.size) return;
    const version = ++loadVersion.current;
    setRefreshing(true);
    setError(null);
    try {
      const data = await getMyDressing();
      if (version === loadVersion.current) setDressing(data.vetements || []);
    } catch (err) {
      if (version === loadVersion.current) setError(err.message);
    } finally {
      if (version === loadVersion.current) { setLoading(false); setRefreshing(false); }
    }
  };

  useEffect(() => {
    let active = true;
    getCategories().then(data => { if (active) setCategories(data); }).catch(() => {
      // Le catalogue reste filtrable via les catégories des vêtements déjà chargés.
    });
    void loadDressing();
    const unsubscribe = navigation.addListener("focus", loadDressing);
    return () => { active = false; unsubscribe(); loadVersion.current += 1; };
  }, [navigation]);

  const mutateItem = async (item, remove = false) => {
    const id = item.id_vetement;
    if (pending.current.has(id)) return;
    pending.current.add(id);
    setPendingIds([...pending.current]);
    loadVersion.current += 1;
    setRefreshing(false);
    try {
      if (remove) await deleteClothing(id);
      else await toggleFavorite(id, item.favori);
      setDressing(items => remove ? items.filter(value => value.id_vetement !== id) :
        items.map(value => value.id_vetement === id ? { ...value, favori: !item.favori } : value));
    } catch (err) {
      Alert.alert("Modification impossible", err.message);
    } finally {
      pending.current.delete(id);
      setPendingIds([...pending.current]);
    }
  };

  const handleDelete = item => Alert.alert("Retirer ce vêtement ?",
    `« ${item.nom} » ne sera plus dans ton dressing ni proposé dans de nouvelles tenues. Ses anciennes tenues et évaluations restent enregistrées jusqu'à la suppression de ton compte.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Retirer", style: "destructive", onPress: () => mutateItem(item, true) }
    ]);
  const clearFilters = () => { setCategory(null); setFavorites(false); setColor(null); setQuery(""); };
  const filtered = filterWardrobe(dressing, { query, category, favorites, color, sort });
  const filterCount = Number(!!category) + Number(favorites) + Number(!!color);
  const favoriteCount = dressing.filter(item => item.favori).length;
  const availableCategories = categories.length ? categories :
    [...new Map(dressing.filter(item => item.sous_categorie?.categorie)
      .map(item => [item.sous_categorie.categorie.id_categorie, item.sous_categorie.categorie])).values()];

  const header = <View style={{ gap: 20, paddingBottom: 24 }}>
    <Heading eyebrow="LA COLLECTION" title="Ton dressing."
      subtitle={`${dressing.length} pièce${dressing.length > 1 ? "s" : ""} · ${favoriteCount} favori${favoriteCount > 1 ? "s" : ""}`}
      action={<IconButton icon="add" label="Ajouter un vêtement" onPress={() => navigation.navigate("AddClothing")}
        style={{ backgroundColor: COLORS.primary }} color="#fff" />} />
    <View style={layout.row}>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={20} color={COLORS.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Une pièce, une marque…"
          accessibilityLabel="Rechercher dans mon dressing" placeholderTextColor={COLORS.muted}
          style={{ flex: 1, fontSize: 15, color: COLORS.text, minHeight: 48 }} returnKeyType="search" />
        {query ? <IconButton icon="close" label="Effacer la recherche" onPress={() => setQuery("")} style={{ width: 40, height: 44 }} /> : null}
      </View>
      <IconButton icon="options-outline" label={`Filtres${filterCount ? `, ${filterCount} actifs` : ""}`}
        onPress={() => setFilterModal(true)} style={{ backgroundColor: filterCount ? COLORS.accent : COLORS.soft }} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      <Chip title="Tout" selected={!category && !favorites && !color} onPress={clearFilters} />
      <Chip title="Favoris" icon="heart-outline" selected={favorites} onPress={() => setFavorites(!favorites)} />
      {availableCategories.map(cat => <Chip key={cat.id_categorie} title={cat.nom_categorie}
        selected={category === cat.id_categorie} onPress={() => setCategory(category === cat.id_categorie ? null : cat.id_categorie)} />)}
    </ScrollView>
    {color ? <Chip title={`Couleur : ${color} · effacer`} selected onPress={() => setColor(null)} /> : null}
    {error ? <View style={{ gap: 10 }}><Notice error message={error} /><Button title="Réessayer" variant="secondary" onPress={loadDressing} /></View> : null}
    {!loading ? <View style={layout.between}>
      <Text style={TYPE.caption}>{filtered.length} pièce{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => setFilterModal(true)} style={{ paddingVertical: 12 }}>
        <Text style={{ ...TYPE.caption, color: COLORS.primary }}>Trier et filtrer ↗</Text>
      </TouchableOpacity>
    </View> : null}
  </View>;

  return <Screen>
    <FlatList data={filtered} numColumns={2} keyExtractor={item => String(item.id_vetement)}
      contentContainerStyle={[layout.content, { gap: 0, flexGrow: 1 }]}
      columnWrapperStyle={{ justifyContent: "space-between" }}
      ListHeaderComponent={header} keyboardShouldPersistTaps="handled"
      refreshing={refreshing && !loading} onRefresh={loadDressing}
      ListEmptyComponent={loading ? <ActivityIndicator size="large" color={COLORS.primary} /> :
        !error ? <EmptyState title={dressing.length ? "Aucune pièce trouvée" : "Tout commence par une pièce."}
          description={dressing.length ? "Essaie un autre mot ou allège tes filtres." : "Ajoute tes vêtements pour les retrouver ici et imaginer tes prochaines tenues."}
          action={<Button title={dressing.length ? "Effacer les filtres" : "Ajouter mon premier vêtement"}
            onPress={dressing.length ? clearFilters : () => navigation.navigate("AddClothing")} />} /> : null}
      renderItem={({ item }) => <View style={styles.card}>
        <TouchableOpacity onPress={() => navigation.navigate("AddClothing", { clothing: item })}
          onLongPress={() => handleDelete(item)} accessibilityRole="button"
          accessibilityLabel={`Modifier ${item.nom}`} activeOpacity={0.8} disabled={pendingIds.includes(item.id_vetement)}>
          <ClothingImage uri={item.photo} style={styles.image} accessibilityLabel={`Photo : ${item.nom}`} />
          <View style={{ padding: 12, gap: 4 }}>
            <Text numberOfLines={2} style={{ ...TYPE.body, fontSize: 14, fontWeight: "600" }}>{item.nom}</Text>
            <View style={[layout.row, { gap: 6 }]}>
              {CLOTHING_COLORS[item.couleur] ? <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1,
                borderColor: COLORS.border, backgroundColor: CLOTHING_COLORS[item.couleur] }} /> : null}
              <Text numberOfLines={1} style={[TYPE.caption, { flex: 1 }]}>{item.marque || item.sous_categorie?.nom_sous_categorie || item.couleur}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <IconButton icon={item.favori ? "heart" : "heart-outline"}
          label={`${item.favori ? "Retirer des favoris" : "Ajouter aux favoris"} : ${item.nom}`}
          disabled={pendingIds.includes(item.id_vetement)} onPress={() => mutateItem(item)}
          color={item.favori ? COLORS.danger : COLORS.text} style={styles.favorite} />
      </View>} />
    <Sheet visible={filterModal} title="À ta façon." subtitle="Combine les filtres pour retrouver tes pièces."
      onClose={() => setFilterModal(false)}
      footer={<Button title={`Voir ${filtered.length} pièce${filtered.length > 1 ? "s" : ""}`} onPress={() => setFilterModal(false)} />}>
      <Text style={layout.sectionLabel}>CATÉGORIE</Text>
      <View style={styles.chips}>
        <Chip title="Toutes" selected={!category} onPress={() => setCategory(null)} />
        {availableCategories.map(cat => <Chip key={cat.id_categorie} title={cat.nom_categorie}
          selected={category === cat.id_categorie} onPress={() => setCategory(cat.id_categorie)} />)}
      </View>
      <Text style={layout.sectionLabel}>COULEUR</Text>
      <View style={styles.chips}>
        {Object.entries(CLOTHING_COLORS).map(([name, hex]) => <TouchableOpacity key={name}
          onPress={() => setColor(color === name ? null : name)} accessibilityRole="button"
          accessibilityLabel={name} accessibilityState={{ selected: color === name }}
          style={{ width: 52, alignItems: "center", gap: 6, paddingVertical: 4 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: hex,
            borderWidth: color === name ? 3 : 1, borderColor: color === name ? COLORS.primary : COLORS.border }} />
          <Text style={{ ...TYPE.caption, fontSize: 11 }}>{name}</Text>
        </TouchableOpacity>)}
      </View>
      <Text style={layout.sectionLabel}>AFFICHAGE</Text>
      <Chip title="Uniquement les favoris" icon="heart-outline" selected={favorites} onPress={() => setFavorites(!favorites)} />
      <View style={styles.chips}>
        {[["favorites", "Favoris d’abord"], ["recent", "Ajouts récents"], ["name", "Nom A–Z"]].map(([key, label]) =>
          <Chip key={key} title={label} selected={sort === key} onPress={() => setSort(key)} />)}
      </View>
      <Button title="Réinitialiser" variant="secondary" onPress={() => { clearFilters(); setSort("favorites"); }} />
    </Sheet>
  </Screen>;
}

const styles = {
  search: { ...layout.row, flex: 1, gap: 8, backgroundColor: COLORS.card, borderRadius: 16, paddingLeft: 14, paddingRight: 4 },
  card: { width: "48%", marginBottom: 18, backgroundColor: COLORS.card, borderRadius: 22, overflow: "hidden" },
  image: { width: "100%", aspectRatio: 0.8, backgroundColor: "#EDEEE8" },
  favorite: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(255,255,255,0.94)", width: 44, height: 44 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }
};
