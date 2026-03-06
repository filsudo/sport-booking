export default function ObchodnePodmienkyPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="animate-section-in rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-8 shadow-sm">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Obchodné podmienky</h1>
        <p className="mt-3 text-slate-600">
          Prehľad základných pravidiel rezervácie, storna a prevádzky športového centra.
        </p>
      </header>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section className="card card-hover animate-section-in p-6">
          <h2 className="text-lg font-bold text-slate-900">1. Rezervácie a potvrdenie</h2>
          <p className="mt-2">
            Rezervácia je platná po úspešnom odoslaní formulára a zaevidovaní v systéme.
            Prevádzkovateľ si vyhradzuje právo upraviť termín po dohode so zákazníkom.
          </p>
        </section>

        <section className="card card-hover animate-section-in p-6 [animation-delay:70ms]">
          <h2 className="text-lg font-bold text-slate-900">2. Platba a storno</h2>
          <p className="mt-2">
            Bezplatné zrušenie rezervácie je možné najneskôr 12 hodín pred začiatkom rezervácie.
          </p>
          <p className="mt-2">
            Neospravedlnená neúčasť môže byť spoplatnená podľa platného cenníka.
          </p>
        </section>

        <section className="card card-hover animate-section-in p-6 [animation-delay:140ms]">
          <h2 className="text-lg font-bold text-slate-900">3. No-show a správanie v centre</h2>
          <p className="mt-2">Klient je povinný dodržiavať pravidlá prevádzky a pokyny personálu.</p>
          <p className="mt-2">V prípade poškodenia vybavenia je klient povinný škodu okamžite nahlásiť.</p>
        </section>
      </div>
    </main>
  )
}
