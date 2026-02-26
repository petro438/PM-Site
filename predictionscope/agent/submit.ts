/**
 * agent/submit.ts
 * 
 * Writes draft articles to the repo and creates a GitHub PR.
 * Also sends notifications via Slack webhook.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { DraftArticle } from './create';

// --- File writing ---

function getContentPath(article: DraftArticle): string {
  const bucketDir: Record<string, string> = {
    educational: 'site/content/learn',
    topical: 'site/content/markets',
    affiliate: 'site/content/best',
  };
  const dir = bucketDir[article.bucket] || 'site/content/markets';

  // Create category subdirectory for topical content
  if (article.bucket === 'topical' && article.category) {
    const fullDir = `${dir}/${article.category}`;
    mkdirSync(fullDir, { recursive: true });
    return `${fullDir}/${article.slug}.md`;
  }

  mkdirSync(dir, { recursive: true });
  return `${dir}/${article.slug}.md`;
}

function writeDraft(article: DraftArticle): string {
  const filepath = getContentPath(article);
  writeFileSync(filepath, article.content, 'utf-8');
  console.log(`[Submit] Wrote draft: ${filepath}`);
  return filepath;
}

// --- Inventory update ---

function updateInventory(articles: DraftArticle[]): void {
  const inventoryPath = 'data/inventory.json';
  let inventory: any[] = [];

  if (existsSync(inventoryPath)) {
    try {
      inventory = JSON.parse(readFileSync(inventoryPath, 'utf-8'));
    } catch {
      inventory = [];
    }
  }

  for (const article of articles) {
    // Don't add duplicates
    if (inventory.some(item => item.slug === article.slug)) continue;

    inventory.push({
      slug: article.slug,
      title: article.title,
      bucket: article.bucket,
      category: article.category,
      targetKeyword: article.targetKeyword,
      wordCount: article.wordCount,
      status: 'draft',
      createdAt: new Date().toISOString(),
    });
  }

  mkdirSync('data', { recursive: true });
  writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2), 'utf-8');
  console.log(`[Submit] Updated inventory: ${inventory.length} total articles`);
}

// --- Git operations ---

function createGitBranch(articles: DraftArticle[]): string {
  const branchName = `agent/drafts-${Date.now()}`;

  try {
    // Ensure we're on main and up to date
    execSync('git checkout main', { stdio: 'pipe' });
    execSync('git pull origin main', { stdio: 'pipe' });

    // Create branch
    execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' });

    // Stage all new/modified files
    execSync('git add -A', { stdio: 'pipe' });

    // Commit
    const slugs = articles.map(a => a.slug).join(', ');
    execSync(
      `git commit -m "feat(agent): draft content — ${slugs}"`,
      { stdio: 'pipe' }
    );

    // Push
    execSync(`git push origin ${branchName}`, { stdio: 'pipe' });

    console.log(`[Submit] Pushed branch: ${branchName}`);
    return branchName;
  } catch (error) {
    console.error('[Submit] Git error:', error);
    throw error;
  }
}

// --- GitHub PR creation ---

async function createPullRequest(
  branchName: string,
  articles: DraftArticle[]
): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || 'your-username/predictionscope';

  if (!token) {
    console.warn('[Submit] No GITHUB_TOKEN — skipping PR creation');
    return '';
  }

  const [owner, repoName] = repo.split('/');

  const body = `## 🤖 Agent Content Drafts

${articles.map(a => `### ${a.title}
- **Bucket**: ${a.bucket}
- **Category**: ${a.category}
- **Target keyword**: \`${a.targetKeyword}\`
- **Word count**: ${a.wordCount}
- **File**: \`${getContentPath(a)}\`
`).join('\n')}

---

**Review checklist:**
- [ ] Market data is accurate and current
- [ ] No fabricated statistics or odds
- [ ] Internal links are correct
- [ ] Affiliate links/promo codes verified (if applicable)
- [ ] Tone matches PredictionScope voice
- [ ] SEO frontmatter looks correct
`;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/pulls`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `[Agent] ${articles.length} new draft${articles.length > 1 ? 's' : ''}: ${articles.map(a => a.slug).join(', ')}`,
          body,
          head: branchName,
          base: 'main',
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[Submit] PR creation failed:', err);
      return '';
    }

    const pr = await response.json();
    console.log(`[Submit] Created PR #${pr.number}: ${pr.html_url}`);
    return pr.html_url;
  } catch (error) {
    console.error('[Submit] PR creation error:', error);
    return '';
  }
}

// --- Slack notification ---

async function sendSlackNotification(
  articles: DraftArticle[],
  prUrl: string
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('[Submit] No SLACK_WEBHOOK_URL — skipping notification');
    return;
  }

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📝 PredictionScope Agent: ${articles.length} new draft${articles.length > 1 ? 's' : ''}`,
      },
    },
    ...articles.map(a => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${a.title}*\nBucket: ${a.bucket} | Keyword: \`${a.targetKeyword}\` | ${a.wordCount} words`,
      },
    })),
  ];

  if (prUrl) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${prUrl}|Review PR →>`,
      },
    });
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    console.log('[Submit] Slack notification sent');
  } catch (error) {
    console.error('[Submit] Slack error:', error);
  }
}

// --- Main submit function ---

export async function submit(articles: DraftArticle[]): Promise<void> {
  console.log(`[Submit] Processing ${articles.length} drafts...`);

  // 1. Write markdown files
  for (const article of articles) {
    writeDraft(article);
  }

  // 2. Update inventory
  updateInventory(articles);

  // 3. Git operations (only in CI/production)
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    const branchName = createGitBranch(articles);
    const prUrl = await createPullRequest(branchName, articles);
    await sendSlackNotification(articles, prUrl);
  } else {
    // Local development — just write files, don't push
    console.log('[Submit] Local mode — files written but no PR created');
    console.log('[Submit] Run `git diff` to see the drafts');
    await sendSlackNotification(articles, '');
  }
}
