// Phase 6 D-22 / Open Q 5 — Stripe success_url landing page.
// Public, no auth. We just thank the user; the order has already been
// moved to CLOSED by the webhook by the time they land here.

export default function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  return (
    <main className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-2xl font-semibold mb-2">Спасибо! / Дякуємо!</h1>
      <p className="text-muted-foreground">
        Оплата прошла успешно. Можете закрыть вкладку.
      </p>
    </main>
  );
}
