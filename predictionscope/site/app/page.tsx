import { getRecentArticles } from '@/lib/content';

export default async function HomePage() {
  const recentArticles = await getRecentArticles(10);

  const educational = recentArticles.filter(a => a.bucket === 'educational');
  const topical = recentArticles.filter(a => a.bucket === 'topical');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight mb-4">
          The World Through<br />
          <span className="text-brand-500">Prediction Markets</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mb-8 leading-relaxed">
          Real-time odds and analysis from Kalshi, Polymarket, and more.
          Politics, entertainment, economics — see what traders are betting on.
        </p>
        <div className="flex gap-4">
          <a
            href="/learn/what-is-a-prediction-market"
            className="bg-brand-600 hover:bg-brand-500 text-white font-display font-semibold px-6 py-3 rounded-lg transition-colors text-sm uppercase tracking-wider"
          >
            What Are Prediction Markets?
          </a>
          <a
            href="/markets"
            className="border border-slate-700 hover:border-slate-500 text-slate-300 font-display font-semibold px-6 py-3 rounded-lg transition-colors text-sm uppercase tracking-wider"
          >
            Browse Markets
          </a>
        </div>
      </section>

      {/* Latest Market Coverage */}
      {topical.length > 0 && (
        <section className="mb-16">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            Latest Market Coverage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topical.slice(0, 4).map(article => (
              <a
                key={article.slug}
                href={`/markets/${article.category}/${article.slug}`}
                className="group block bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 hover:border-brand-600/30 transition-all"
              >
                <span className="text-xs font-mono text-brand-500 uppercase tracking-wider">
                  {article.category}
                </span>
                <h3 className="font-display text-lg font-semibold text-slate-100 mt-1 group-hover:text-brand-400 transition-colors">
                  {article.title}
                </h3>
                <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                  {article.description}
                </p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Learn Section */}
      {educational.length > 0 && (
        <section className="mb-16">
          <h2 className="font-display text-2xl font-bold mb-6">
            Learn Prediction Markets
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {educational.slice(0, 6).map(article => (
              <a
                key={article.slug}
                href={`/learn/${article.slug}`}
                className="group block bg-slate-900/30 border border-slate-800/30 rounded-lg p-4 hover:border-brand-600/20 transition-all"
              >
                <h3 className="font-display text-base font-semibold text-slate-200 group-hover:text-brand-400 transition-colors">
                  {article.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                  {article.description}
                </p>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Empty state for brand new site */}
      {recentArticles.length === 0 && (
        <section className="py-16 text-center">
          <p className="text-slate-500 text-lg">
            Content coming soon. The agent is working on it.
          </p>
        </section>
      )}
    </div>
  );
}
