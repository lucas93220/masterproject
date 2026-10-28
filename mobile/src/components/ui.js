import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal,
  ScrollView, KeyboardAvoidingView, Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../styles/colors";
import { TYPE } from "../styles/theme";

export const layout = {
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 32, gap: 24, width: "100%", maxWidth: 720, alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  card: { backgroundColor: COLORS.card, borderRadius: 24, padding: 20, gap: 16 },
  divider: { height: 1, backgroundColor: COLORS.border },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: COLORS.text, flex: 1 },
  sectionLabel: { ...TYPE.eyebrow, color: COLORS.muted, marginBottom: 4 }
};

export function Screen({ children, scroll = false, keyboard = false, edges = ["top"], contentStyle }) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={[layout.content, contentStyle]}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {children}
    </ScrollView>
  ) : children;
  return (
    <SafeAreaView edges={edges} style={layout.screen}>
      {keyboard ? <KeyboardAvoidingView style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>{content}</KeyboardAvoidingView> : content}
    </SafeAreaView>
  );
}

export function Heading({ eyebrow, title, subtitle, action }) {
  return <View style={layout.between}>
    <View style={{ flex: 1, gap: 8 }}>
      {eyebrow ? <Text style={TYPE.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={TYPE.display}>{title}</Text>
      {subtitle ? <Text style={TYPE.caption}>{subtitle}</Text> : null}
    </View>
    {action}
  </View>;
}

export function Button({ title, icon, onPress, loading = false, disabled = false, variant = "primary", style, ...props }) {
  const blocked = disabled || loading;
  const foreground = variant === "primary" ? "#fff" : variant === "danger" ? COLORS.danger : COLORS.primary;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: blocked, busy: loading }} activeOpacity={0.75}
    {...props} onPress={onPress} disabled={blocked}
    style={[{ minHeight: 52, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16,
      flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10,
      backgroundColor: variant === "primary" ? COLORS.primary : variant === "danger" ? COLORS.dangerSoft : COLORS.soft,
      opacity: blocked ? 0.55 : 1 }, style]}>
    {loading ? <ActivityIndicator color={foreground} /> : icon ? <Ionicons name={icon} size={19} color={foreground} /> : null}
    <Text style={{ color: foreground, fontWeight: "600", fontSize: 15, flexShrink: 1 }}>{title}</Text>
  </TouchableOpacity>;
}

export function IconButton({ icon, label, onPress, disabled = false, style, color = COLORS.text }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} activeOpacity={0.7}
    style={[{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center",
      backgroundColor: COLORS.card, opacity: disabled ? 0.5 : 1 }, style]}>
    <Ionicons name={icon} size={22} color={color} />
  </TouchableOpacity>;
}

export function Field({ label, hint, style, trailing, ...inputProps }) {
  return <View style={[{ gap: 8 }, style]}>
    <Text style={{ ...TYPE.caption, fontWeight: "600", color: COLORS.text }}>{label}</Text>
    <View style={layout.row}>
      <TextInput accessibilityLabel={label} placeholderTextColor={COLORS.muted}
        style={[layout.input, inputProps.editable === false && { opacity: 0.6 }]} {...inputProps} />
      {trailing}
    </View>
    {hint ? <Text style={TYPE.caption}>{hint}</Text> : null}
  </View>;
}

export function Chip({ title, selected, onPress, icon, disabled = false }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected, disabled }}
    disabled={disabled} onPress={onPress} activeOpacity={0.75}
    style={{ minHeight: 44, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 11,
      borderWidth: 1, borderColor: selected ? COLORS.primary : COLORS.border,
      backgroundColor: selected ? COLORS.primary : COLORS.card,
      flexDirection: "row", alignItems: "center", gap: 7, opacity: disabled ? 0.5 : 1 }}>
    {icon ? <Ionicons name={icon} size={16} color={selected ? "#fff" : COLORS.primary} /> : null}
    <Text style={{ fontSize: 13, fontWeight: "600", color: selected ? "#fff" : COLORS.text }}>{title}</Text>
  </TouchableOpacity>;
}

export function Sheet({ visible, title, subtitle, onClose, children, footer, header, keyboard = false }) {
  const Container = keyboard ? KeyboardAvoidingView : View;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Container behavior={keyboard ? Platform.OS === 'ios' ? 'padding' : 'height' : undefined}
      style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(20,32,25,0.45)" }}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fermer la fenêtre" accessibilityRole="button" />
      <SafeAreaView edges={["bottom", "left", "right"]} accessibilityViewIsModal
        style={{ maxHeight: "88%", backgroundColor: COLORS.background, borderTopLeftRadius: 30,
          borderTopRightRadius: 30, width: "100%", maxWidth: 640, alignSelf: "center" }}>
        <View style={{ alignSelf: "center", width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, marginTop: 10 }} />
        <View style={[layout.between, { padding: 24, paddingBottom: 16 }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text accessibilityRole="header" style={TYPE.title}>{title}</Text>
            {subtitle ? <Text style={TYPE.caption}>{subtitle}</Text> : null}
          </View>
          <IconButton icon="close" label="Fermer" onPress={onClose} />
        </View>
        {header ? <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>{header}</View> : null}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 20 }}>
          {children}
        </ScrollView>
        {footer ? <View style={{ padding: 24, paddingTop: 12 }}>{footer}</View> : null}
      </SafeAreaView>
    </Container>
  </Modal>;
}

export function EmptyState({ icon = "shirt-outline", title, description, action }) {
  return <View style={{ padding: 28, gap: 14, alignItems: "center" }}>
    <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: COLORS.soft, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={30} color={COLORS.primary} />
    </View>
    <Text accessibilityRole="header" style={[TYPE.title, { textAlign: "center" }]}>{title}</Text>
    <Text style={[TYPE.caption, { textAlign: "center", maxWidth: 300 }]}>{description}</Text>
    {action}
  </View>;
}

export function Notice({ message, error = false }) {
  return <View accessibilityLiveRegion="polite" style={[layout.row, {
    padding: 14, borderRadius: 16, backgroundColor: error ? COLORS.dangerSoft : COLORS.soft
  }]}>
    <Ionicons name={error ? "alert-circle-outline" : "checkmark-circle-outline"} size={20}
      color={error ? COLORS.danger : COLORS.primary} />
    <Text style={[TYPE.caption, { flex: 1, color: error ? COLORS.danger : COLORS.primary }]}>{message}</Text>
  </View>;
}
