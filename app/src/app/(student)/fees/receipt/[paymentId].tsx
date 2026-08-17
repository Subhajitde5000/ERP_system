/**
 * C-ST-20 fee receipt — port of StudentFeeReceiptPage in
 * fontend/components/student/student-fees.tsx. The website renders it as a
 * printable sheet; the app renders the same official receipt card (the
 * browser Print button has no mobile counterpart).
 */

import { StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Receipt } from "lucide-react-native";

import { AsyncState } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateOnly, inr, statusLabel } from "@/lib/format";
import { useInstitutionAuth } from "@/lib/session";
import { fetchStudentFees } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors, Radius } from "@/theme";

export default function StudentFeeReceiptPage() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const id = paymentId ?? "";
  const { user } = useInstitutionAuth();
  const resource = useResource(fetchStudentFees, []);
  const payment = resource.data?.payments.find((row) => row.id === id) ?? null;

  return (
    <Screen>
      <PageHeader title="Fee receipt" subtitle="Your official receipt for this payment." />
      <AsyncState
        loading={resource.loading}
        error={resource.error}
        onRetry={resource.reload}
        loadingLabel="Loading your receipt…"
      >
        {resource.data ? (
          payment ? (
            <Card>
              <View style={styles.heading}>
                <Receipt size={32} color={Colors.accent} />
                <Text style={styles.receiptTitle}>Official fee receipt</Text>
                <Text style={styles.receiptNumber}>Receipt No. {payment.receipt_number}</Text>
                {resource.data.academic_year ? (
                  <Text style={styles.academicYear}>Academic year {resource.data.academic_year}</Text>
                ) : null}
              </View>
              <View style={styles.rows}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Student</Text>
                  <Text style={styles.rowValue}>{user?.name ?? "—"}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Payment date</Text>
                  <Text style={styles.rowValue}>{dateOnly(payment.payment_date)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Payment mode</Text>
                  <Text style={styles.rowValue}>{statusLabel(payment.payment_mode)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Transaction reference</Text>
                  <Text style={styles.rowValue}>{payment.transaction_reference ?? "—"}</Text>
                </View>
                {payment.notes ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Notes</Text>
                    <Text style={styles.rowValue}>{payment.notes}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colTowards]}>Towards</Text>
                <Text style={[styles.th, styles.colAmount]}>Amount</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={[styles.towards, styles.colTowards]}>
                  Tuition &amp; fees — {resource.data.academic_year ?? "current academic year"}
                </Text>
                <Text style={[styles.amount, styles.colAmount]}>{inr(payment.amount)}</Text>
              </View>
              <View style={styles.tableTotal}>
                <Text style={[styles.totalCell, styles.colTowards]}>Total received</Text>
                <Text style={[styles.totalCell, styles.colAmount]}>{inr(payment.amount)}</Text>
              </View>

              <View style={styles.footerRows}>
                <Text style={styles.footerRow}>
                  Balance after this payment:{" "}
                  <Text style={styles.footerValue}>{inr(resource.data.balance_due)}</Text>
                </Text>
                <Text style={styles.footerRow}>
                  Account status: <Text style={styles.footerValue}>{statusLabel(resource.data.status)}</Text>
                </Text>
              </View>
              <Text style={styles.generated}>Computer-generated receipt — no signature required.</Text>
            </Card>
          ) : (
            <Card>
              <EmptyState text="This receipt was not found on your fee account." />
              <View style={styles.backWrap}>
                <Link href="/(student)/fees" asChild>
                  <View style={styles.backButton}>
                    <ArrowLeft size={14} color={Colors.primary} />
                    <Text style={styles.backLabel}>Back to my fee account</Text>
                  </View>
                </Link>
              </View>
            </Card>
          )
        ) : null}
      </AsyncState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: 16,
    alignItems: "center",
  },
  receiptTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: Colors.primary,
    textAlign: "center",
  },
  receiptNumber: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  academicYear: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  rows: {
    marginTop: 16,
    gap: 8,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.mutedForeground,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  tableHead: {
    marginTop: 16,
    flexDirection: "row",
    borderTopWidth: 2,
    borderBottomWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 8,
  },
  th: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  colTowards: {
    flex: 1,
    paddingRight: 12,
  },
  colAmount: {
    width: 100,
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  towards: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.primary,
  },
  amount: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  tableTotal: {
    flexDirection: "row",
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
    paddingVertical: 8,
  },
  totalCell: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  footerRows: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    gap: 8,
    alignItems: "center",
  },
  footerRow: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.mutedForeground,
    textAlign: "center",
  },
  footerValue: {
    color: Colors.primary,
  },
  generated: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 11,
    color: Colors.mutedForeground,
  },
  backWrap: {
    marginTop: 12,
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    borderRadius: Radius.field,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
  },
  backLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
});
