import type { Metadata } from 'next';
import { Barlow_Condensed, Source_Sans_3, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const displayFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const bodyFont = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-body',
  display: 'swap',
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PredictionScope — The World Through Prediction Markets',
    template: '%s | PredictionScope',
  },
  description: 'Track prediction market odds for politics, entertainment, economics, and sports. Real-time data from Kalshi, Polymarket, and more.',
  openGraph: {
    type: 'website',
    siteName: 'PredictionScope',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body className="bg-slate-950 text-slate-100 font-body antialiased">
        {/* Header */}
        <header className="border-b border-slate-800/60 sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 group">
              <span className="text-brand-600 font-display text-2xl font-bold tracking-tight group-hover:text-brand-400 transition-colors">
                PREDICTION<span className="text-slate-100">SCOPE</span>
              </span>
            </a>
            <nav className="hidden sm:flex items-center gap-8 text-sm font-medium">
              <a href="/learn" className="text-slate-400 hover:text-slate-100 transition-colors">Learn</a>
              <a href="/markets" className="text-slate-400 hover:text-slate-100 transition-colors">Markets</a>
              <a href="/best/prediction-market-apps" className="text-slate-400 hover:text-slate-100 transition-colors">Best Apps</a>
            </nav>
            {/* Mobile nav toggle would go here */}
          </div>
        </header>

        {/* Main content */}
        <main className="min-h-screen">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/60 mt-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-100 mb-3">
                  PREDICTION<span className="text-brand-600">SCOPE</span>
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  The world through the lens of prediction markets. Real-time odds, analysis, and guides.
                </p>
              </div>
              <div>
                <h4 className="font-display text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Learn</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="/learn/what-is-a-prediction-market" className="text-slate-500 hover:text-brand-400 transition-colors">What Is a Prediction Market?</a></li>
                  <li><a href="/learn/how-to-read-prediction-market-odds" className="text-slate-500 hover:text-brand-400 transition-colors">How to Read Odds</a></li>
                  <li><a href="/learn/are-prediction-markets-legal" className="text-slate-500 hover:text-brand-400 transition-colors">Are They Legal?</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-display text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Platforms</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="/best/prediction-market-apps" className="text-slate-500 hover:text-brand-400 transition-colors">Best Prediction Market Apps</a></li>
                  <li><a href="/best/kalshi-review" className="text-slate-500 hover:text-brand-400 transition-colors">Kalshi Review</a></li>
                  <li><a href="/best/kalshi-vs-polymarket" className="text-slate-500 hover:text-brand-400 transition-colors">Kalshi vs Polymarket</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-10 pt-6 border-t border-slate-800/40 text-xs text-slate-600">
              <p>&copy; {new Date().getFullYear()} PredictionScope. Not financial advice. PredictionScope may earn a commission from partner links.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
