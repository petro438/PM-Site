import { getArticle, getSlugsForBucket, generateSchema } from '@/lib/content';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle('best', params.slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
    },
  };
}

export async function generateStaticParams() {
  const slugs = await getSlugsForBucket('best');
  return slugs.map(slug => ({ slug }));
}

export default async function BestArticlePage({ params }: Props) {
  const article = await getArticle('best', params.slug);
  if (!article) notFound();

  const schema = generateSchema(article);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-slate-500 mb-6">
          <a href="/" className="hover:text-brand-400 transition-colors">Home</a>
          <span className="mx-2">/</span>
          <a href="/best/prediction-market-apps" className="hover:text-brand-400 transition-colors">Best Apps</a>
          <span className="mx-2">/</span>
          <span className="text-slate-400">{article.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight mb-3">
            {article.title}
          </h1>
          <p className="text-lg text-slate-400">
            {article.description}
          </p>
          <div className="mt-4 text-sm text-slate-500">
            <time dateTime={article.dateUpdated || article.dateCreated}>
              Updated {new Date(article.dateUpdated || article.dateCreated).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </time>
          </div>
        </header>

        {/* Content */}
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />

        {/* Affiliate disclosure — more prominent on commercial pages */}
        <div className="mt-12 p-4 bg-slate-900/50 border border-slate-800/50 rounded-lg text-xs text-slate-500">
          <strong className="text-slate-400">Disclosure:</strong> PredictionScope may earn a commission when you sign up for prediction market platforms through links on this page. This helps support our editorial operations but does not affect our rankings or reviews. All opinions are our own.
        </div>
      </article>
    </>
  );
}
