export default function OchranaOsobnychUdajovPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="animate-section-in rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-8 shadow-sm">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Ochrana osobných údajov</h1>
        <p className="mt-3 text-slate-600">
          Informácie o spracovaní osobných údajov v súlade s GDPR pri používaní rezervačného systému.
        </p>
      </header>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section className="card card-hover animate-section-in p-6">
          <h2 className="text-lg font-bold text-slate-900">1. Spracovanie údajov</h2>
          <p className="mt-2">
            Spracúvame len údaje nevyhnutné pre správu rezervácií: meno, email alebo telefón,
            termín rezervácie a poznámku.
          </p>
        </section>

        <section className="card card-hover animate-section-in p-6 [animation-delay:70ms]">
          <h2 className="text-lg font-bold text-slate-900">2. Účel spracovania</h2>
          <p className="mt-2">
            Údaje používame výhradne na potvrdenie, správu a komunikáciu ohľadom rezervácie.
          </p>
        </section>

        <section className="card card-hover animate-section-in p-6 [animation-delay:140ms]">
          <h2 className="text-lg font-bold text-slate-900">3. Práva dotknutej osoby</h2>
          <p className="mt-2">
            Máte právo na prístup k údajom, opravu, výmaz, obmedzenie spracovania a podanie námietky
            podľa platných právnych predpisov.
          </p>
        </section>
      </div>
    </main>
  )
}
