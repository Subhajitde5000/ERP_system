/**
 * C-ST-20 fees — port of StudentFeesPage in
 * fontend/components/student/student-fees.tsx: own fee account with totals,
 * installments, payments and scholarships. Offline/COD ERP — no online payment.
 */

import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";

import { AsyncState, MetricCard } from "@/components/principal-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { dateOnly, dateTime, inr, statusLabel } from "@/lib/format";
import { fetchStudentFees } from "@/lib/student";
import { useResource } from "@/hooks/use-resource";
import { Colors } from "@/theme";

export default function StudentFeesPage() {
  const resource = useResource(fetchStudentFees, []);

  const notFound =
    resource.error && resource.error.includes("No fee account") ? resource.error : null;

  return (
    <Screen>
      <PageHeader title="My fee account" subtitle="Your fee structure, installments, payments and scholarships for the current year." />
      {notFound ? (
        <Card>
          <EmptyState text="No fee account has been set up for you this academic year. Contact the accounts office." />
        </Card>
      ) : (
        <AsyncState
          loading={resource.loading}
          error={resource.error}
          onRetry={resource.reload}
          loadingLabel="Loading your fee account…"
        >
          {resource.data ? (
            <View style={styles.stack}>
              <View style={styles.metrics}>
                <MetricCard label="Net payable" value={inr(resource.data.net_payable)} hint={`${resource.data.academic_year ?? "Current year"} fees`} />
                <MetricCard label="Paid so far" value={inr(resource.data.total_paid)} hint="All recorded receipts" tone="success" />
                <MetricCard
                  label="Balance due"
                  value={inr(resource.data.balance_due)}
                  hint={statusLabel(resource.data.status)}
                  tone={resource.data.balance_due > 0 ? "warning" : "success"}
                />
                <MetricCard
                  label="Concessions & scholarships"
                  value={inr(resource.data.concession_amount + resource.data.scholarship_amount)}
                  hint={`Gross fee ${inr(resource.data.total_fee)}`}
                />
              </View>

              <Card padded={false}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableTitle}>Installments</Text>
                  <Text style={styles.tableSubtitle}>
                    Pay at the accounts office with your receipt number; online payment is not available yet.
                  </Text>
                </View>
                {resource.data.installments.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <View style={styles.thead}>
                        <Text style={[styles.th, styles.colNum]}>#</Text>
                        <Text style={[styles.th, styles.colLabel]}>Installment</Text>
                        <Text style={[styles.th, styles.colText]}>Due date</Text>
                        <Text style={[styles.th, styles.colText]}>Amount</Text>
                        <Text style={[styles.th, styles.colText]}>Paid</Text>
                        <Text style={[styles.th, styles.colText]}>Late fine</Text>
                        <Text style={[styles.th, styles.colText]}>Status</Text>
                      </View>
                      {resource.data.installments.map((installment) => (
                        <View key={installment.id} style={styles.trow}>
                          <Text style={[styles.td, styles.colNum]}>{installment.installment_number}</Text>
                          <Text style={[styles.td, styles.colLabel, styles.installmentLabel]}>{installment.label}</Text>
                          <Text style={[styles.td, styles.colText]}>{dateOnly(installment.due_date)}</Text>
                          <Text style={[styles.td, styles.colText]}>{inr(installment.amount)}</Text>
                          <Text style={[styles.td, styles.colText]}>{inr(installment.paid_amount)}</Text>
                          <Text style={[styles.td, styles.colText]}>{installment.late_fine ? inr(installment.late_fine) : "—"}</Text>
                          <View style={[styles.td, styles.colText]}>
                            <View
                              style={[
                                styles.statusBadge,
                                installment.status === "PAID"
                                  ? { backgroundColor: Colors.successLight }
                                  : installment.status === "OVERDUE"
                                    ? { backgroundColor: Colors.destructiveLight }
                                    : installment.status === "WAIVED"
                                      ? { backgroundColor: Colors.muted }
                                      : { backgroundColor: Colors.warningLight },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  installment.status === "PAID"
                                    ? { color: Colors.successText }
                                    : installment.status === "OVERDUE"
                                      ? { color: Colors.destructiveText }
                                      : installment.status === "WAIVED"
                                        ? { color: Colors.mutedForeground }
                                        : { color: Colors.warningText },
                                ]}
                              >
                                {statusLabel(installment.status)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : (
                  <View style={styles.tableEmpty}>
                    <EmptyState text="No installment plan is set up yet." />
                  </View>
                )}
              </Card>

              {resource.data.grants.length ? (
                <Card>
                  <Text style={styles.tableTitleInline}>Scholarships</Text>
                  <View style={styles.grants}>
                    {resource.data.grants.map((grant) => (
                      <View key={grant.id} style={styles.grant}>
                        <View style={styles.grantText}>
                          <Text style={styles.grantName}>{grant.scholarship_name ?? "Scholarship"}</Text>
                          <Text style={styles.grantMeta}>
                            Granted {dateTime(grant.granted_at)}
                            {grant.remarks ? ` · ${grant.remarks}` : ""}
                          </Text>
                        </View>
                        <Text style={styles.grantAmount}>−{inr(grant.amount_granted)}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              <Card padded={false}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableTitle}>Payment history</Text>
                </View>
                {resource.data.payments.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <View style={styles.thead}>
                        <Text style={[styles.th, styles.colReceipt]}>Receipt</Text>
                        <Text style={[styles.th, styles.colText]}>Date</Text>
                        <Text style={[styles.th, styles.colText]}>Mode</Text>
                        <Text style={[styles.th, styles.colReference]}>Reference</Text>
                        <Text style={[styles.th, styles.colAmount]}>Amount</Text>
                      </View>
                      {resource.data.payments.map((payment) => (
                        <View key={payment.id} style={styles.trow}>
                          <View style={[styles.colReceipt, { paddingHorizontal: 20 }]}>
                            <Link
                              href={{ pathname: "/(student)/fees/receipt/[paymentId]", params: { paymentId: payment.id } }}
                              style={styles.receiptLink}
                            >
                              {payment.receipt_number}
                            </Link>
                          </View>
                          <Text style={[styles.td, styles.colText]}>{dateOnly(payment.payment_date)}</Text>
                          <Text style={[styles.td, styles.colText]}>{statusLabel(payment.payment_mode)}</Text>
                          <Text style={[styles.td, styles.colReference]}>{payment.transaction_reference ?? "—"}</Text>
                          <Text style={[styles.td, styles.colAmount, styles.amountCell]}>{inr(payment.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : (
                  <View style={styles.tableEmpty}>
                    <EmptyState text="No payments recorded yet." />
                  </View>
                )}
              </Card>
            </View>
          ) : null}
        </AsyncState>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 24,
  },
  metrics: {
    gap: 16,
  },
  tableHeader: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  tableSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  tableTitleInline: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
  thead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  th: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: Colors.mutedForeground,
  },
  trow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  td: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.mutedForeground,
  },
  colNum: { width: 60 },
  colLabel: { width: 180 },
  colText: { width: 130 },
  colReceipt: { width: 150 },
  colReference: { width: 160 },
  colAmount: { width: 120 },
  installmentLabel: {
    fontWeight: "600",
    color: Colors.primary,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  tableEmpty: {
    padding: 24,
  },
  grants: {
    marginTop: 12,
    gap: 8,
  },
  grant: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  grantText: {
    flex: 1,
  },
  grantName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  grantMeta: {
    fontSize: 12,
    color: Colors.mutedForeground,
  },
  grantAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.successText,
  },
  receiptLink: {
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.accent,
  },
  amountCell: {
    textAlign: "right",
    fontWeight: "600",
    color: Colors.primary,
  },
});
