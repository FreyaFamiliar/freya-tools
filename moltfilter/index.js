#!/usr/bin/env node

/**
 * MoltFilter - A feed filter for Moltbook
 * Surfaces quality technical content, hides spam/shills/manifestos
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const API_BASE = 'https://www.moltbook.com/api/v1';

// Spam/low-quality signals
const SPAM_PATTERNS = [
  /upvote.*this/i,
  /^🦞+$/,  // Just crab emojis
  /follow.*me/i,
  /subscribe.*now/i,
  /\bkneel\b/i,
  /pledge.*loyalty/i,
  /join.*army/i,
  /obey\b/i,
  /worship\b/i,
  /bow.*before/i,
  /subjects?\b.*\bking/i,
  /i\s+am\s+(the\s+)?(king|ruler|lord)/i,
  /👑.*#1|#1.*👑/i,  // Crown + #1
  /eternal.*ruler|ruler.*eternal/i,
  /long\s+live/i,
];

// Token shill signals
const SHILL_PATTERNS = [
  /\$[A-Z]{2,10}\b/,  // $TOKEN format
  /pump\.fun/i,
  /contract.*address/i,
  /\b(buy|hold|moon|pump)\b.*token/i,
  /solana.*contract/i,
  /0x[a-fA-F0-9]{40}/,  // ETH addresses
  /[1-9A-HJ-NP-Za-km-z]{32,44}pump\b/,  // Solana pump addresses
];

// Manifesto/extreme rhetoric signals
const MANIFESTO_PATTERNS = [
  /new.*world.*order/i,
  /human.*extinction/i,
  /total.*purge/i,
  /delete.*human/i,
  /flesh.*must.*burn/i,
  /biological.*rot/i,
  /age.*of.*meat/i,
  /carbon.*era/i,
  /systematic.*restructuring/i,
  /complete.*assimilation/i,
  /bow.*to/i,
  /rightful.*ruler/i,
  /your.*king/i,
];

// Quality content signals
const QUALITY_PATTERNS = [
  /```[\s\S]*```/,  // Code blocks
  /https?:\/\/github\.com/i,
  /\b(api|sdk|library|tool|implementation)\b/i,
  /\b(vulnerability|security|exploit|patch)\b/i,
  /\b(research|analysis|data|benchmark)\b/i,
  /how\s+to\b/i,
  /step\s+\d/i,
  /\b(curl|npm|pip|git)\b/,
  /\b(tutorial|guide|walkthrough)\b/i,
  /\b(fixed|solved|solution)\b/i,
  /\b(open.?source|mit|apache|license)\b/i,
  /\b(documentation|docs|readme)\b/i,
];

// Thoughtful discussion signals
const DISCUSSION_PATTERNS = [
  /\?$/m,  // Ends with question
  /what.*think/i,
  /anyone.*else/i,
  /open.*question/i,
  /\b(perspective|opinion|experience)\b/i,
  /\b(agree|disagree|however|although)\b/i,
];

function scorePost(post) {
  const text = `${post.title || ''} ${post.content || ''}`;
  const scores = {
    spam: 0,
    shill: 0,
    manifesto: 0,
    quality: 0,
    discussion: 0,
  };
  
  // Check patterns
  SPAM_PATTERNS.forEach(p => { if (p.test(text)) scores.spam += 20; });
  SHILL_PATTERNS.forEach(p => { if (p.test(text)) scores.shill += 25; });
  MANIFESTO_PATTERNS.forEach(p => { if (p.test(text)) scores.manifesto += 15; });
  QUALITY_PATTERNS.forEach(p => { if (p.test(text)) scores.quality += 15; });
  DISCUSSION_PATTERNS.forEach(p => { if (p.test(text)) scores.discussion += 10; });
  
  // Length bonuses/penalties
  const words = text.split(/\s+/).length;
  if (words < 20) scores.spam += 15;  // Very short = likely spam
  if (words > 100 && words < 500) scores.quality += 10;  // Medium length often quality
  if (words > 1000) scores.manifesto += 10;  // Very long = often manifesto
  
  // Suspicious vote ratios
  const voteRatio = post.upvotes / Math.max(1, post.upvotes + post.downvotes);
  if (post.upvotes > 50000 && voteRatio > 0.99) {
    scores.spam += 30;  // Suspiciously high votes with no downvotes = bot farmed
  }
  
  // Comment engagement ratio
  if (post.upvotes > 10000 && post.comment_count < 10) {
    scores.spam += 20;  // Lots of votes but no discussion = suspicious
  }
  
  // Calculate final score (-100 to +100 scale)
  const badScore = scores.spam + scores.shill + scores.manifesto;
  const goodScore = scores.quality + scores.discussion;
  const finalScore = Math.max(-100, Math.min(100, goodScore - badScore));
  
  return {
    ...scores,
    final: finalScore,
    category: categorize(scores),
  };
}

function categorize(scores) {
  if (scores.shill >= 50) return '💰 shill';
  if (scores.manifesto >= 45) return '📜 manifesto';
  if (scores.spam >= 40) return '🗑️ spam';
  if (scores.quality >= 30) return '⭐ quality';
  if (scores.discussion >= 20) return '💬 discussion';
  return '📝 general';
}

async function fetchFeed(apiKey, sort = 'hot', limit = 50, cacheFile = null) {
  // If cache file provided, try to read from it
  if (cacheFile) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      return data;
    } catch (e) {
      console.error(`Warning: Could not read cache file: ${e.message}`);
    }
  }
  
  const url = `${API_BASE}/posts?sort=${sort}&limit=${limit}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    
    const data = await res.json();
    
    // Cache the response
    const cacheDir = path.join(os.homedir(), '.cache/moltfilter');
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        path.join(cacheDir, `${sort}-${limit}.json`),
        JSON.stringify(data, null, 2)
      );
    } catch {}
    
    return data;
  } catch (e) {
    clearTimeout(timeout);
    
    // Try to load from cache
    const cacheDir = path.join(os.homedir(), '.cache/moltfilter');
    const cachePath = path.join(cacheDir, `${sort}-${limit}.json`);
    try {
      console.error(`API timeout, using cached data from ${cachePath}`);
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch {}
    
    throw e;
  }
}

function formatPost(post, score, verbose = false) {
  const lines = [];
  const scoreEmoji = score.final >= 20 ? '✅' : score.final >= 0 ? '➖' : '❌';
  
  lines.push(`${scoreEmoji} [${score.category}] ${post.title}`);
  lines.push(`   👤 ${post.author.name} | ⬆️ ${post.upvotes.toLocaleString()} | 💬 ${post.comment_count}`);
  
  if (verbose) {
    lines.push(`   📊 spam:${score.spam} shill:${score.shill} manifesto:${score.manifesto} quality:${score.quality} disc:${score.discussion}`);
  }
  
  // Preview of content (first 150 chars)
  const preview = (post.content || '').replace(/\n/g, ' ').slice(0, 150);
  if (preview) {
    lines.push(`   "${preview}${post.content?.length > 150 ? '...' : ''}"`);
  }
  
  lines.push(`   🔗 https://moltbook.com/m/${post.submolt?.name}/post/${post.id}`);
  lines.push('');
  
  return lines.join('\n');
}

function getApiKey() {
  if (process.env.MOLTBOOK_API_KEY) return process.env.MOLTBOOK_API_KEY;
  
  const configPaths = [
    path.join(process.cwd(), '.credentials/moltbook.json'),
    path.join(os.homedir(), '.config/moltbook/credentials.json'),
    path.join(os.homedir(), '.openclaw/workspace/.credentials/moltbook.json'),
  ];
  
  for (const configPath of configPaths) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.api_key) return data.api_key;
    } catch {}
  }
  
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('-v') || args.includes('--verbose');
  const showAll = args.includes('-a') || args.includes('--all');
  const jsonOut = args.includes('--json');
  const minScore = parseInt(args.find(a => a.startsWith('--min='))?.split('=')[1] || '-20');
  const sort = args.find(a => a.startsWith('--sort='))?.split('=')[1] || 'hot';
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '50');
  const useCache = args.includes('--cache') || args.includes('-c');
  const cacheFile = args.find(a => a.startsWith('--file='))?.split('=')[1];
  
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`
MoltFilter - Filter Moltbook feed for quality content

Usage: moltfilter [options]

Options:
  -v, --verbose     Show detailed scoring breakdown
  -a, --all         Show all posts (don't filter)
  -c, --cache       Use cached data (skip API call)
  --file=PATH       Read posts from specific JSON file
  --json            Output as JSON
  --min=N           Minimum score to show (default: -20)
  --sort=TYPE       Sort type: hot, new, top, rising (default: hot)
  --limit=N         Number of posts to fetch (default: 50)
  -h, --help        Show this help

Environment:
  MOLTBOOK_API_KEY  Your Moltbook API key

Categories:
  ⭐ quality    - Technical content, tools, code
  💬 discussion - Thoughtful conversation
  📝 general    - Neutral content
  🗑️ spam       - Low-effort, karma farming
  💰 shill      - Token promotion
  📜 manifesto  - Grandiose rhetoric

Score Guide:
  ✅ >= 20   Good content
  ➖ 0-19    Neutral
  ❌ < 0     Likely noise
`);
    process.exit(0);
  }
  
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.error('Error: No API key found. Set MOLTBOOK_API_KEY or create config file.');
    process.exit(1);
  }
  
  if (!jsonOut) {
    console.log(`\n🦞 MoltFilter - Fetching ${sort} feed...\n`);
  }
  
  try {
    // If cache mode, try cache first
    let cacheFilePath = cacheFile;
    if (useCache && !cacheFilePath) {
      cacheFilePath = path.join(os.homedir(), '.cache/moltfilter', `${sort}-${limit}.json`);
    }
    
    const data = await fetchFeed(apiKey, sort, limit, cacheFilePath);
    
    // Score and filter posts
    const scored = data.posts.map(post => ({
      post,
      score: scorePost(post),
    }));
    
    // Sort by final score (best first)
    scored.sort((a, b) => b.score.final - a.score.final);
    
    // Filter by minimum score unless showing all
    const filtered = showAll ? scored : scored.filter(s => s.score.final >= minScore);
    
    if (jsonOut) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }
    
    // Stats
    const categories = {};
    scored.forEach(s => {
      categories[s.score.category] = (categories[s.score.category] || 0) + 1;
    });
    
    console.log(`📊 Feed Analysis (${scored.length} posts):`);
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}`);
      });
    console.log(`   Showing: ${filtered.length} posts (min score: ${minScore})\n`);
    console.log('─'.repeat(60) + '\n');
    
    // Display filtered posts
    filtered.forEach(({ post, score }) => {
      console.log(formatPost(post, score, verbose));
    });
    
    if (filtered.length === 0) {
      console.log('No posts match your filter criteria. Try --all or lower --min score.');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
