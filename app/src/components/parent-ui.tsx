/**
 * Shared parent-screen furniture (mobile).
 *
 * The order inside `ChildGate` is the point. Loading, then error, then "this
 * account has no child", then "this child's link does not grant this area" — the
 * four states a guardian can arrive in, in the order they can actually happen.
 * Getting it wrong looks like a bug: a family whose link expired is shown an empty
 * list instead of the reason, and they ring the office about a blank screen.
 */

import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";

import { AsyncState, EmptyTable } from "@/components/principal-ui";
import { Card } from "@/components/ui";
import { moduleLabel } from "@/lib/parent";
import { useParentConsole } from "@/lib/parent-console";
import { Colors, Radius } from "@/theme";

/** Gate every per-child screen: session → roster → module → content. */
export function ChildGate({
  module,
  title,
  subtitle,
  children,
}: {
  module?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { activeChild, allows, loading, error, reload } = useParentConsole();

  if (loading && !activeChild) {
    return (
      <View style={styles.wrap}>
        <AsyncState loading error={null} onRetry={reload} loadingLabel="Opening your portal…">
          {null}
        </AsyncState>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.wrap}>
        <AsyncState loading={false} error={error} onRetry={reload}>
          {null}
        </AsyncState>
      </View>
    );
  }
  if (!activeChild) {
    return (
      <View style={styles.wrap}>
        <Card>
          <EmptyTable text="No student is linked to your account yet. The school office links a guardian to an admission record; once that is done the portal opens." />
        </Card>
      </View>
    );
  }
  if (module && !allows(module)) {
    return (
      <View style={styles.wrap}>
        <ModuleDenied module={module} childName={activeChild.name} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>{title.replace("{child}", activeChild.name.split(" ")[0] ?? activeChild.name)}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <AccessNotice />
      {children}
    </View>
  );
}

/**
 * Sits above every child screen: the two facts that change what the numbers mean —
 * the link is closed, or it is about to be. Silence here is what turns a
 * "the app is broken" call into a "the school closed access on 31 March" note.
 */
function AccessNotice() {
  const { activeChild } = useParentConsole();
  if (!activeChild) return null;

  if (!activeChild.is_live) {
    return (
      <Banner
        text={
          activeChild.blocked_reason === "SUSPENDED"
            ? `Access for ${activeChild.name} is paused by the school. What is already shown here stays readable; nothing new is shared.`
            : `Access for ${activeChild.name} ended${activeChild.access_upto ? ` on ${activeChild.access_upto}` : ""}. Ask the office to extend it.`
        }
      />
    );
  }
  if (activeChild.days_left !== null && activeChild.days_left <= 30) {
    return (
      <Banner
        text={`Access for ${activeChild.name} ends in ${activeChild.days_left} day${activeChild.days_left === 1 ? "" : "s"}. The school can extend it before then.`}
      />
    );
  }
  return null;
}

function Banner({ text }: { text: string }) {
  return (
    <View style={styles.banner}>
      <AlertTriangle size={16} color={Colors.warningText} />
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

export function ModuleDenied({ module, childName }: { module: string; childName: string | null }) {
  return (
    <Card style={styles.denied}>
      <Text style={styles.deniedTitle}>{moduleLabel(module)} is not open for {childName ?? "this child"}</Text>
      <Text style={styles.deniedBody}>
        Your account is linked to {childName ?? "this child"}, but the school has not granted this area. Access
        is set per child and per guardian — a parent can hold it while the other does not, and a sibling at
        another school is a separate record. The office can change it in a minute; nothing you can see
        elsewhere is affected.
      </Text>
    </Card>
  );
}

/** Label/value pair — the mobile shape of the website's `FactGrid`. */
export function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/** One row in a list card; `onPress` only when the row opens something. */
export function DataRow({
  title,
  meta,
  right,
  onPress,
}: {
  title: string;
  meta?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      {right}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{body}</View>;
  }
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} style={styles.row}>
      {body}
    </TouchableOpacity>
  );
}

export function Chip({ label, tone = "muted" }: { label: string; tone?: "muted" | "success" | "warning" | "danger" }) {
  const palette = {
    muted: { bg: Colors.muted, fg: Colors.bodyText },
    success: { bg: Colors.successLight, fg: Colors.successText },
    warning: { bg: Colors.warningLight, fg: Colors.warningText },
    danger: { bg: Colors.destructiveLight, fg: Colors.destructiveText },
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: palette.bg }]}>
      <Text style={[styles.chipLabel, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  head: { gap: 4 },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4, color: Colors.primary },
  subtitle: { fontSize: 14, lineHeight: 20, color: Colors.mutedForeground },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    backgroundColor: Colors.warningLight,
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 17, color: Colors.warningText },
  denied: { gap: 8 },
  deniedTitle: { fontSize: 16, fontWeight: "700", color: Colors.primary },
  deniedBody: { fontSize: 13, lineHeight: 20, color: Colors.mutedForeground },
  fact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  factLabel: { fontSize: 12, color: Colors.mutedForeground, flexShrink: 0 },
  factValue: { fontSize: 13, fontWeight: "600", color: Colors.foreground, textAlign: "right", flexShrink: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.primary, marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: Colors.foreground },
  rowMeta: { fontSize: 12, color: Colors.mutedForeground },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chipLabel: { fontSize: 11, fontWeight: "700" },
});
