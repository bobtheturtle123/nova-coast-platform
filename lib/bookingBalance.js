// Recomputes what a client still owes when a booking's total changes (e.g. a
// custom line item is added or removed on an existing booking). The guiding
// rule: money that already changed hands is never recomputed. A paid deposit is
// a fixed historical fact — adding items raises the outstanding balance, it does
// NOT re-derive the deposit from the new total.
//
// Returns the fields to write: always { remainingBalance }, plus { depositAmount }
// only when nothing has been paid yet (safe to re-derive the expected deposit).
export function recomputeBalance({
  newTotal,
  discount = 0,
  depositPaid = false,
  balancePaid = false,
  paidInFull = false,
  priorDeposit = 0,
  depositPct = 0.5,
}) {
  const netTotal = Math.max(0, (Number(newTotal) || 0) - (Number(discount) || 0));

  if (balancePaid || paidInFull) {
    // Fully settled — nothing further owed; leave the paid deposit untouched.
    return { remainingBalance: 0 };
  }
  if (depositPaid) {
    // Deposit already collected: fixed amount. Only the balance moves.
    const paid = Number(priorDeposit) || 0;
    return { remainingBalance: Math.max(0, netTotal - paid) };
  }
  // Nothing paid — safe to re-derive the expected deposit from config.
  const depositAmount = Math.round(netTotal * (Number(depositPct) || 0) * 100) / 100;
  return { depositAmount, remainingBalance: netTotal };
}
