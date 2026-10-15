export async function syncOrderRefunds(order, supabaseAdmin, razorpay) {
  const { data: localRefunds, error: localRefundsError } = await supabaseAdmin
    .from("order_refunds")
    .select("id, amount, status, razorpay_refund_id, error, created_at")
    .eq("order_id", order.id);
  if (localRefundsError) throw localRefundsError;

  const gatewayRefunds = [];
  let skip = 0;
  let totalCount = 0;
  do {
    const result = await razorpay.refunds.all({
      payment_id: order.razorpay_payment_id,
      count: 100,
      skip,
    });
    const items = result.items || [];
    gatewayRefunds.push(...items);
    totalCount = result.count || items.length;
    skip += items.length;
  } while (skip < totalCount && items.length === 100);

  const unclaimedRefunds = new Set(gatewayRefunds.map((refund) => refund.id));
  const unresolvedLocalRefunds = [];

  for (const localRefund of localRefunds || []) {
    let gatewayRefund = localRefund.razorpay_refund_id
      ? gatewayRefunds.find((refund) => refund.id === localRefund.razorpay_refund_id)
      : null;

    if (!gatewayRefund && !localRefund.razorpay_refund_id && ["pending", "unknown"].includes(localRefund.status)) {
      const amountPaise = Math.round(Number(localRefund.amount) * 100);
      const candidates = gatewayRefunds.filter(
        (refund) => unclaimedRefunds.has(refund.id) && refund.amount === amountPaise
      );
      if (candidates.length === 1) gatewayRefund = candidates[0];
    }

    if (!gatewayRefund) {
      if (["pending", "unknown"].includes(localRefund.status)) {
        unresolvedLocalRefunds.push(localRefund);
      }
      continue;
    }

    unclaimedRefunds.delete(gatewayRefund.id);
    const status = gatewayRefund.status;
    const error = status === "failed"
      ? gatewayRefund.error_reason || "Razorpay reported a failed refund."
      : null;
    if (
      localRefund.razorpay_refund_id !== gatewayRefund.id
      || localRefund.status !== status
      || localRefund.error !== error
    ) {
      const { error: updateError } = await supabaseAdmin
        .from("order_refunds")
        .update({
          razorpay_refund_id: gatewayRefund.id,
          status,
          error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", localRefund.id);
      if (updateError) throw updateError;
    }
  }

  const processedAmountPaise = gatewayRefunds
    .filter((refund) => refund.status === "processed")
    .reduce((total, refund) => total + Number(refund.amount || 0), 0);
  const hasPendingRefund = gatewayRefunds.some(
    (refund) => !["processed", "failed"].includes(refund.status)
  ) || unresolvedLocalRefunds.length > 0;
  const refundedAmount = processedAmountPaise / 100;
  const refundStatus = hasPendingRefund
    ? "pending"
    : processedAmountPaise >= Math.round(Number(order.total_amount) * 100)
      ? "full"
      : processedAmountPaise > 0
        ? "partial"
        : null;

  const { error: orderUpdateError } = await supabaseAdmin
    .from("orders")
    .update({ refunded_amount: refundedAmount, refund_status: refundStatus })
    .eq("id", order.id);
  if (orderUpdateError) throw orderUpdateError;

  return { refunded_amount: refundedAmount, refund_status: refundStatus };
}
