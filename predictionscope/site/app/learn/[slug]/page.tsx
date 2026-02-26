import { getArticle, getSlugsForBucket, generateSchema } from '@/lib/content';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticle('learn', params.slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.dateCreated,
      modifiedTime: article.dateUpdated,
    },
  };
}

export async function generateStaticParams() {
  const slugs = await getSlugsForBucket('learn');
  return slugs.map(slug => ({ slug }));
}

export default async function LearnArticlePage({ params }: Props) {
  const article = await getArticle('learn', params.slug);
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
          <a href="/learn" className="hover:text-brand-400 transition-colors">Learn</a>
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
          <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
            <span>By {article.author}</span>
            <span className="w-1 h-1 rounded-full bg-slate-600" />
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

        {/* Affiliate disclosure */}
        <div className="mt-12 pt-6 border-t border-slate-800/50 text-xs text-slate-600">
          PredictionScope may earn a commission when you sign up through our links. This doesn&apos;t affect our editorial independence.
        </div>
      </article>
    </>
  );
}
