import { Platform } from "react-native";
import { COLORS } from "./colors";

export const TYPE = {
  display: {
    fontFamily: Platform.OS === "ios" || Platform.OS === "web" ? "Georgia" : "serif",
    fontSize: 36,
    lineHeight: 42,
    color: COLORS.text
  },
  title: { fontSize: 20, fontWeight: "600", color: COLORS.text },
  body: { fontSize: 15, lineHeight: 22, color: COLORS.text },
  caption: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: COLORS.primary }
};

export const RADIUS = {
  sm: 8,
  md: 16,
  lg: 24
};

export const SHADOW = {
  light: {
    shadowColor: "#202B26",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  }
};
