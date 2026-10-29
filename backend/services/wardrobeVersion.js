// Activer seulement après la migration 20261029_wardrobe_v3.sql.
const wardrobeV3 = () => process.env.FITS_WARDROBE_V3 === '1';
module.exports = { wardrobeV3 };
