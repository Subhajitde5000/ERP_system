/**
 * Input field — port of fontend/components/ui/text-field.tsx (design §6.2).
 * h-44px · radius 10px · border #E2E8F0 · focus indigo ring 3px.
 */

import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type KeyboardTypeOptions } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

import { Colors, Radius } from "@/theme";

export function TextField({
  label,
  value,
  onChangeText,
  error,
  labelAction,
  revealable,
  placeholder,
  multiline = false,
  keyboardType,
  autoCapitalize = "none",
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  /** Rendered at the top-right of the field, e.g. the "Forgot?" link */
  labelAction?: React.ReactNode;
  /** Adds a show/hide toggle */
  revealable?: boolean;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAction}
      </View>

      <View
        style={[
          styles.field,
          multiline && styles.multilineField,
          focused
            ? { borderColor: error ? Colors.destructive : Colors.accent, ...focusRing(error) }
            : { borderColor: error ? Colors.destructive : "#E2E8F0" },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          secureTextEntry={revealable && !revealed}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && styles.multilineInput, revealable && styles.revealableInput]}
        />
        {revealable ? (
          <TouchableOpacity
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            accessibilityState={{ selected: revealed }}
            onPress={() => setRevealed((v) => !v)}
            style={styles.revealButton}
          >
            {revealed ? (
              <EyeOff size={16} color={Colors.placeholder} />
            ) : (
              <Eye size={16} color={Colors.placeholder} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** focus:ring-3 focus:ring-accent/15 */
function focusRing(error?: string | null) {
  const color = error ? "rgba(239,68,68,0.15)" : "rgba(79,70,229,0.15)";
  return {
    shadowColor: color,
    shadowOpacity: 1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  };
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.labelText,
  },
  field: {
    marginTop: 6,
    borderRadius: Radius.field,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  multilineField: {
    alignItems: "flex-start",
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 12,
  },
  multilineInput: {
    minHeight: 112,
    textAlignVertical: "top",
  },
  revealableInput: {
    paddingRight: 44,
  },
  revealButton: {
    position: "absolute",
    right: 12,
    top: 12,
    padding: 2,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "500",
    color: Colors.destructiveText,
  },
});
