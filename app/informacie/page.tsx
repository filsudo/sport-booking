export default function InformaciePage() {
  const rules = [
    'Vstup na hraciu plochu len v čistej športovej obuvi s nefarbiacou podrážkou.',
    'Prosíme prísť 5–10 minút pred začiatkom rezervácie.',
    'Rezerváciu je možné zrušiť najneskôr 12 hodín vopred (telefonicky/emailom).',
    'Pri poškodení vybavenia je používateľ povinný okamžite nahlásiť škodu.',
    'Na hracej ploche je zákaz jedla a sklenených fliaš.',
  ]

  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="animate-section-in rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-blue-50 p-8 shadow-sm">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Informácie</h1>
        <p className="mt-3 text-slate-600">
          Základné pravidlá prevádzky, kontakty a dôležité informácie pre návštevníkov centra.
        </p>
      </header>

      <section className="card mt-8 p-6">
        <h2 className="text-xl font-bold text-slate-900">O nás</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Sme športové centrum zamerané na tenis, bedminton, stolný tenis a tréningové programy.
          Naším cieľom je jednoduchý a transparentný rezervačný systém, v ktorom má hráč vždy jasný prehľad
          o dostupnosti termínov.
        </p>
      </section>

      <section className="mt-6 card p-6">
        <h2 className="text-xl font-bold text-slate-900">Pravidlá prevádzky</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-700">
          {rules.map((rule) => (
            <li key={rule} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="card card-hover animate-section-in p-5">
          <h3 className="font-bold text-slate-900">Otváracie hodiny</h3>
          <p className="mt-2 text-sm text-slate-700">Denne 09:00 – 21:00</p>
        </article>
        <article className="card card-hover animate-section-in p-5 [animation-delay:80ms]">
          <h3 className="font-bold text-slate-900">Kontakt</h3>
          <p className="mt-2 text-sm text-slate-700">info@sportbook.sk • +421 2 1234 5678</p>
        </article>
      </section>
    </main>
  )
}
