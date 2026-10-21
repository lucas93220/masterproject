// Organisation locale de l'affichage uniquement ; aucun effet sur les recommandations.
const normalized = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function filterWardrobe(items, { query = "", category = null, favorites = false, color = null, sort = "favorites" } = {}) {
  const needle = normalized(query.trim());
  const result = items.filter(item =>
    (!needle || normalized(`${item.nom} ${item.marque || ""}`).includes(needle)) &&
    (!category || String(item.sous_categorie?.id_categorie) === String(category)) &&
    (!favorites || item.favori) &&
    (!color || item.couleur === color)
  );
  return result.sort((a, b) => {
    if (sort === "name") return (a.nom || "").localeCompare(b.nom || "", "fr");
    if (sort === "recent") return b.id_vetement - a.id_vetement;
    return Number(b.favori) - Number(a.favori) || b.id_vetement - a.id_vetement;
  });
}
