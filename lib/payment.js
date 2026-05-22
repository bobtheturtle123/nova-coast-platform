export function payLabel(l) {
  if (l.paidInFull || l.balancePaid) return { label: "Paid in full", color: "#059669", bg: "#ECFDF5" };
  if (l.depositPaid)                 return { label: "Deposit paid",  color: "#3486cf", bg: "#E8F2FD" };
  return                                    { label: "Unpaid",        color: "#9CA3AF", bg: "#F9FAFB" };
}

export function paidAmount(l) {
  if (l.paidInFull || l.balancePaid) return l.totalPrice || 0;
  if (l.depositPaid)                 return l.depositAmount || 0;
  return 0;
}
