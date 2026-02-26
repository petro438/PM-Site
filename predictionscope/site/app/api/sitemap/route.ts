import { getAllArticles } from '@/lib/content';

const BASE_URL = 'https://predictionscope.com';

export async function GET() {
  const articles = await getAllArticles();

  const staticPages = [
    { url: '/', priority: 1.0, changefreq: 'daily' },
    { url: '/learn', priority: 0.8, changefreq: 'weekly' },
    { url: '/markets', priority: 0.8, changefreq: 'daily' },
  ];

  const articlePages = articles.map(article => {
    let url = '';
    switch (article.bucket) {
      case 'educational':
        url = `/learn/${article.slug}`;
        break;
      case 'topical':
        url = `/markets/${article.category}/${article.slug}`;
        break;
      case 'affiliate':
        url = `/best/${article.slug}`;
        break;
    }

    // Topical content changes more frequently
    const changefreq = article.bucket === 'topical' ? 'daily' : 'weekly';
    const priority = article.bucket === 'affiliate' ? 0.9 : 0.7;

    return {
      url,
      lastmod: article.dateUpdated || article.dateCreated,
      priority,
      changefreq,
    };
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(page => `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <priority>${page.priority}</priority>
    <changefreq>${page.changefreq}</changefreq>
  </url>`).join('\n')}
${articlePages.map(page => `  <url>
    <loc>${BASE_URL}${page.url}</loc>
    ${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ''}
    <priority>${page.priority}</priority>
    <changefreq>${page.changefreq}</changefreq>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
