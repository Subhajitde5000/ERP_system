/**
 * Select field — the app counterpart of the website's styled `<select>`
 * (inputClass: h-44px · radius 10px · border #E2E8F0). Native phones have no
 * dropdown element, so the same-looking field opens a modal option list.
 */

import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Check, ChevronDown } from "lucide-react-native";

import { Colors, Radius } from "@/theme";

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={styles.field}
      >
        <Text style={[styles.value, !current && styles.placeholder]} numberOfLines={1}>
          {current?.label ?? ""}
        </Text>
        <ChevronDown size={16} color={Colors.mutedForeground} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{label ?? "Choose"}</Text>
          <FlatList
            data={options}
            keyExtractor={(option) => option.value || "all"}
            style={styles.list}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <TouchableOpacity
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                    {item.label}
                  </Text>
                  {selected ? <Check size={16} color={Colors.accent} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "500",
    color: Colors.labelText,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    height: 44,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
  },
  placeholder: {
    color: Colors.placeholder,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "70%",
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    backgroundColor: "#FFFFFF",
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetTitle: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  optionSelected: {
    backgroundColor: Colors.accentLight,
  },
  optionLabel: {
    fontSize: 14,
    color: Colors.foreground,
  },
  optionLabelSelected: {
    color: Colors.accent,
    fontWeight: "600",
  },
});
