import { COLORS } from "./colors";
import { RADIUS, SHADOW } from "./theme";

export const CARD = {
  backgroundColor: COLORS.card,
  borderRadius: RADIUS.md,
  padding: 12,
  ...SHADOW.light
};

export const BUTTON_PRIMARY = {
  backgroundColor: COLORS.primary,
  paddingVertical: 12,
  borderRadius: 30,
  alignItems: "center"
};

export const BUTTON_TEXT = {
  color: "#fff",
  fontWeight: "600"
};