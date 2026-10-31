export const PAID_PAYMENT_STATUSES = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"];

export function checkoutStatus(hasConfirmedPayment: boolean): "active" | "pending" {
  return hasConfirmedPayment ? "active" : "pending";
}