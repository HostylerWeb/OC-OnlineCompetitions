export function walletBalanceToBand(amount: number): "zero" | "low" | "medium" | "high" {
  if (amount <= 0) return "zero";
  if (amount < 10) return "low";
  if (amount < 50) return "medium";
  return "high";
}
