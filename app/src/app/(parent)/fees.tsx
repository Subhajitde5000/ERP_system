/**
 * C-PA-11 — fees for one child (mobile port of ParentChildFeesPage).
 *
 * The most sensitive screen in this portal: money, on a device that may be
 * unlocked in front of a sibling. Which is why `finance` is its own module on the
 * link, why a school can grant it to one parent and not the other, and why the
 * balance arrives already filtered server-side rather than hidden by the client.
 *
 * Payment is not accepted here, and the screen says so: a guardian who pays
 * through a link in a webview and then finds the balance unchanged has a
 * reconciliation problem the office cannot see.
 */

import { StyleSheet, Text, View } from "react-native";

import { AsyncState, MetricCard } from "@/components/principal-ui";
import { ChildGate, Chip, DataRow, FactRow } from "@/components/parent-ui";
import { Screen } from "@/components/screen";
import { Card, EmptyState } from "@/components/ui";
import { dateOnly, inr, statusLabel } from "@/lib/format";
import { fetchChildFees } from "@/lib/parent";
import { useChildId } from "@/lib/parent-console";
import { useResource } from "@/hooks/use-resource";
import { Colors } from "@/theme";

export default function ParentFeesPage() {
  const childId = useChildId();
  const fees = useResource(() => fetchChildFees(childId), [childId]);

  return (
    <Screen>
      <ChildGate module="finance" title="{child} — fees" subtitle="The account as the accounts department has it">
        <AsyncState loading={fees.loading} error={fees.error} onRetry={fees.reload} loadingLabel="Loading the fee account…">
          {fees.data ? (
            <View style={styles.stack}>
              <View style={styles.metrics}>
                <MetricCard label="Net payable" value={inr(fees.data.net_payable)} hint={fees.data.academic_year ?? "this year"} />
                <MetricCard label="Paid" value={inr(fees.data.total_paid)} tone="success" />
                <MetricCard
                  label="Balance due"
                  value={inr(fees.data.balance_due)}
                  tone={fees.data.balance_due > 0 ? "warning" : "success"}
                  hint={statusLabel(fees.data.status)}
                />
                <MetricCard
                  label="Waived"
                  value={inr(fees.data.concession_amount + fees.data.scholarship_amount)}
                  hint="Applied by the school"
                />
              </View>

              <Card padded={false}>
                <Text style={styles.cardTitle}>Instalments</Text>
                {fees.data.installments.length ? (
                  fees.data.installments.map((item) => (
                    <DataRow
                      key={item.id}
                      title={item.label}
                      meta={`Instalment ${item.installment_number} · due ${dateOnly(item.due_date)} · ${inr(item.paid_amount)} paid${
                        item.late_fine ? ` · late fine ${inr(item.late_fine)}` : ""
                      }`}
                      right={<Chip label={statusLabel(item.status)} tone={item.status === "PAID" ? "success" : item.status === "OVERDUE" ? "danger" : "warning"} />}
                    />
                  ))
                ) : (
                  <EmptyState text="The school has not raised an instalment for this year." />
                )}
              </Card>

              <Card padded={false}>
                <Text style={styles.cardTitle}>Receipts</Text>
                {fees.data.payments.length ? (
                  fees.data.payments.map((payment) => (
                    <DataRow
                      key={payment.id}
                      title={`${inr(payment.amount)} · ${statusLabel(payment.payment_mode)}`}
                      meta={`${payment.receipt_number} · ${dateOnly(payment.payment_date)}${
                        payment.transaction_reference ? ` · ref ${payment.transaction_reference}` : ""
                      }`}
                    />
                  ))
                ) : (
                  <EmptyState text="Nothing has been received against this account." />
                )}
              </Card>

              {fees.data.grants.length ? (
                <Card>
                  <Text style={styles.cardTitle}>Scholarships applied</Text>
                  {fees.data.grants.map((grant) => (
                    <FactRow
                      key={grant.id}
                      label={grant.scholarship_name ?? "Grant"}
                      value={`${inr(grant.amount_granted)} · ${dateOnly(grant.granted_at)}`}
                    />
                  ))}
                </Card>
              ) : null}

              <Text style={styles.footnote}>
                Payment is not accepted here, and the balance shown is the accounts department&apos;s figure. If
                you have paid and dues remain, quote the receipt number to the office — it is reconciled on
                this same screen.
              </Text>
            </View>
          ) : null}
        </AsyncState>
      </ChildGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: Colors.primary, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  footnote: { fontSize: 11, lineHeight: 16, color: Colors.mutedForeground },
});
