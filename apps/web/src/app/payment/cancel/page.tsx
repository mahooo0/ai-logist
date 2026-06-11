// Phase 6 D-22 / Open Q 5 — Stripe cancel_url landing page.
// Public, no auth. Notifies the user that payment was cancelled.

export default function PaymentCancelPage() {
  return (
    <main className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-2xl font-semibold mb-2">Оплата отменена</h1>
      <p className="text-muted-foreground">
        Если вы передумали — закройте эту вкладку. Мы пришлём ссылку снова.
      </p>
    </main>
  );
}
