// Organisation locale de l'affichage uniquement ; aucun effet sur les recommandations.
const normalized = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function filterWardrobe(items, { query = "", category = null, favorites = false, color = null, sort = "favorites", groups = [] } = {}) {
  const needle = normalized(query.trim());
  const result = items.filter(item =>
    (!needle || normalized(`${item.nom} ${item.marque || ""}`).includes(needle)) &&
    (!category || (groups.length ? groups.find(group => group.id_categorie === category)?.subcategories.some(sub => sub.id_sous_categorie === item.id_sous_categorie) : String(item.sous_categorie?.id_categorie) === String(category))) &&
    (!favorites || item.favori) &&
    (!color || item.couleur === color || item.couleur_secondaire === color)
  );
  return result.sort((a, b) => {
    if (sort === "name") return (a.nom || "").localeCompare(b.nom || "", "fr");
    if (sort === "recent") return b.id_vetement - a.id_vetement;
    return Number(b.favori) - Number(a.favori) || b.id_vetement - a.id_vetement;
  });
}
