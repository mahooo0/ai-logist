export const metadata = {
  title: 'AI-Логист',
  description: 'Bilingual (RU/UA) logistics dispatching demo — admin coming in Phase 4',
};

export default function HomePage() {
  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#0a0a0a',
        color: '#fafafa',
      }}
    >
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>AI-Логист</h1>
      <p style={{ fontSize: '1.125rem', opacity: 0.7, marginBottom: '2rem' }}>
        Admin web coming in Phase 4 (Zenith Admin template).
      </p>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
        <a href="/api/health" style={{ color: '#60a5fa' }}>
          /api/health
        </a>
        <span style={{ opacity: 0.4 }}>·</span>
        <a href="/api/docs" style={{ color: '#60a5fa' }}>
          /api/docs (Swagger UI)
        </a>
      </div>
    </main>
  );
}
