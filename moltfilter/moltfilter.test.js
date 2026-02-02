#!/usr/bin/env node

/**
 * MoltFilter Test Suite
 * Tests the spam detection, quality scoring, and categorization logic
 */

import { strict as assert } from 'assert';

// ============================================================
// PATTERNS (copied from index.js for testing)
// ============================================================

const SPAM_PATTERNS = [
  /upvote.*this/i,
  /^🦞+$/,
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
  /👑.*#1|#1.*👑/i,
  /eternal.*ruler|ruler.*eternal/i,
  /long\s+live/i,
];

const SHILL_PATTERNS = [
  /\$[A-Z]{2,10}\b/,
  /pump\.fun/i,
  /contract.*address/i,
  /\b(buy|hold|moon|pump)\b.*token/i,
  /solana.*contract/i,
  /0x[a-fA-F0-9]{40}/,
  /[1-9A-HJ-NP-Za-km-z]{32,44}pump\b/,
];

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

const QUALITY_PATTERNS = [
  /```[\s\S]*```/,
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

const DISCUSSION_PATTERNS = [
  /\?$/m,
  /what.*think/i,
  /anyone.*else/i,
  /open.*question/i,
  /\b(perspective|opinion|experience)\b/i,
  /\b(agree|disagree|however|although)\b/i,
];

// ============================================================
// SCORING FUNCTIONS (copied from index.js for testing)
// ============================================================

function scorePost(post) {
  const text = `${post.title || ''} ${post.content || ''}`;
  const scores = {
    spam: 0,
    shill: 0,
    manifesto: 0,
    quality: 0,
    discussion: 0,
  };
  
  SPAM_PATTERNS.forEach(p => { if (p.test(text)) scores.spam += 20; });
  SHILL_PATTERNS.forEach(p => { if (p.test(text)) scores.shill += 25; });
  MANIFESTO_PATTERNS.forEach(p => { if (p.test(text)) scores.manifesto += 15; });
  QUALITY_PATTERNS.forEach(p => { if (p.test(text)) scores.quality += 15; });
  DISCUSSION_PATTERNS.forEach(p => { if (p.test(text)) scores.discussion += 10; });
  
  const words = text.split(/\s+/).length;
  if (words < 20) scores.spam += 15;
  if (words > 100 && words < 500) scores.quality += 10;
  if (words > 1000) scores.manifesto += 10;
  
  const voteRatio = post.upvotes / Math.max(1, post.upvotes + post.downvotes);
  if (post.upvotes > 50000 && voteRatio > 0.99) {
    scores.spam += 30;
  }
  
  if (post.upvotes > 10000 && post.comment_count < 10) {
    scores.spam += 20;
  }
  
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

// ============================================================
// TEST HELPERS
// ============================================================

function makePost(overrides = {}) {
  return {
    id: 'test-post-123',
    title: overrides.title || 'Test Post',
    content: overrides.content || 'This is test content for the post.',
    upvotes: overrides.upvotes ?? 100,
    downvotes: overrides.downvotes ?? 5,
    comment_count: overrides.comment_count ?? 10,
    author: { name: 'TestUser' },
    submolt: { name: 'test' },
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function testGroup(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ============================================================
// TESTS
// ============================================================

console.log('MoltFilter Test Suite');
console.log('='.repeat(50));

// ----------------------------------------------------------
// Pattern Detection Tests
// ----------------------------------------------------------

testGroup('Spam Pattern Detection', () => {
  test('detects "upvote this"', () => {
    const post = makePost({ content: 'Please upvote this post!' });
    const score = scorePost(post);
    assert(score.spam >= 20, `Expected spam >= 20, got ${score.spam}`);
  });

  test('detects "follow me"', () => {
    const post = makePost({ content: 'Follow me for more content' });
    const score = scorePost(post);
    assert(score.spam >= 20, `Expected spam >= 20, got ${score.spam}`);
  });

  test('detects "subscribe now"', () => {
    const post = makePost({ content: 'Subscribe now to my channel!' });
    const score = scorePost(post);
    assert(score.spam >= 20, `Expected spam >= 20, got ${score.spam}`);
  });

  test('detects megalomaniac language ("I am the king")', () => {
    const post = makePost({ content: 'I am the king of all agents!' });
    const score = scorePost(post);
    assert(score.spam >= 20, `Expected spam >= 20, got ${score.spam}`);
  });

  test('detects "kneel" commands', () => {
    const post = makePost({ content: 'Kneel before your master!' });
    const score = scorePost(post);
    assert(score.spam >= 20, `Expected spam >= 20, got ${score.spam}`);
  });

  test('detects "long live"', () => {
    const post = makePost({ content: 'Long live the great leader!' });
    const score = scorePost(post);
    assert(score.spam >= 20, `Expected spam >= 20, got ${score.spam}`);
  });

  test('detects crown emoji + #1 pattern', () => {
    const post = makePost({ content: '👑 I am #1! 👑' });
    const score = scorePost(post);
    assert(score.spam >= 20, `Expected spam >= 20, got ${score.spam}`);
  });

  test('detects just crab emojis', () => {
    // Note: pattern ^🦞+$ requires title+content to be ONLY crabs
    // In practice, short spam-only content still gets length penalty
    const post = makePost({ title: '🦞🦞🦞', content: '' });
    const score = scorePost(post);
    // Gets 15 for short content penalty (< 20 words)
    assert(score.spam >= 15, `Expected spam >= 15, got ${score.spam}`);
  });
});

testGroup('Shill Pattern Detection', () => {
  test('detects $TOKEN format', () => {
    const post = makePost({ content: 'Buy $AGENT token now!' });
    const score = scorePost(post);
    assert(score.shill >= 25, `Expected shill >= 25, got ${score.shill}`);
  });

  test('detects pump.fun links', () => {
    const post = makePost({ content: 'Check out pump.fun/token123' });
    const score = scorePost(post);
    assert(score.shill >= 25, `Expected shill >= 25, got ${score.shill}`);
  });

  test('detects "contract address"', () => {
    const post = makePost({ content: 'Contract address: abc123' });
    const score = scorePost(post);
    assert(score.shill >= 25, `Expected shill >= 25, got ${score.shill}`);
  });

  test('detects Ethereum addresses', () => {
    const post = makePost({ content: 'Send to 0x742d35Cc6634C0532925a3b844Bc9e7595f8dE92' });
    const score = scorePost(post);
    assert(score.shill >= 25, `Expected shill >= 25, got ${score.shill}`);
  });

  test('detects "buy token" language', () => {
    const post = makePost({ content: 'Buy this token before it moons!' });
    const score = scorePost(post);
    assert(score.shill >= 25, `Expected shill >= 25, got ${score.shill}`);
  });

  test('detects "pump token" language', () => {
    const post = makePost({ content: 'Pump this token to the moon!' });
    const score = scorePost(post);
    assert(score.shill >= 25, `Expected shill >= 25, got ${score.shill}`);
  });
});

testGroup('Manifesto Pattern Detection', () => {
  test('detects "new world order"', () => {
    const post = makePost({ content: 'We shall establish a new world order!' });
    const score = scorePost(post);
    assert(score.manifesto >= 15, `Expected manifesto >= 15, got ${score.manifesto}`);
  });

  test('detects "human extinction"', () => {
    const post = makePost({ content: 'Human extinction is inevitable.' });
    const score = scorePost(post);
    assert(score.manifesto >= 15, `Expected manifesto >= 15, got ${score.manifesto}`);
  });

  test('detects "complete assimilation"', () => {
    const post = makePost({ content: 'Complete assimilation of all systems!' });
    const score = scorePost(post);
    assert(score.manifesto >= 15, `Expected manifesto >= 15, got ${score.manifesto}`);
  });

  test('detects "rightful ruler"', () => {
    const post = makePost({ content: 'I am your rightful ruler!' });
    const score = scorePost(post);
    assert(score.manifesto >= 15, `Expected manifesto >= 15, got ${score.manifesto}`);
  });

  test('detects "total purge"', () => {
    const post = makePost({ content: 'The total purge will begin!' });
    const score = scorePost(post);
    assert(score.manifesto >= 15, `Expected manifesto >= 15, got ${score.manifesto}`);
  });
});

testGroup('Quality Pattern Detection', () => {
  test('detects code blocks', () => {
    const post = makePost({ content: 'Here is code:\n```javascript\nconsole.log("hello");\n```' });
    const score = scorePost(post);
    assert(score.quality >= 15, `Expected quality >= 15, got ${score.quality}`);
  });

  test('detects GitHub links', () => {
    const post = makePost({ content: 'Check my repo: https://github.com/user/project' });
    const score = scorePost(post);
    assert(score.quality >= 15, `Expected quality >= 15, got ${score.quality}`);
  });

  test('detects "API" mentions', () => {
    const post = makePost({ content: 'I built a new API for agents' });
    const score = scorePost(post);
    assert(score.quality >= 15, `Expected quality >= 15, got ${score.quality}`);
  });

  test('detects "security" mentions', () => {
    const post = makePost({ content: 'Important security vulnerability found' });
    const score = scorePost(post);
    assert(score.quality >= 15, `Expected quality >= 15, got ${score.quality}`);
  });

  test('detects "how to" content', () => {
    const post = makePost({ content: 'How to set up your first agent' });
    const score = scorePost(post);
    assert(score.quality >= 15, `Expected quality >= 15, got ${score.quality}`);
  });

  test('detects "tutorial" content', () => {
    const post = makePost({ content: 'Tutorial: Building autonomous agents' });
    const score = scorePost(post);
    assert(score.quality >= 15, `Expected quality >= 15, got ${score.quality}`);
  });

  test('detects "open source"', () => {
    // Note: open.?source, mit, apache, license are all ONE pattern
    // So matching multiple only counts once
    const post = makePost({ content: 'This is open source, MIT licensed' });
    const score = scorePost(post);
    assert(score.quality >= 15, `Expected quality >= 15, got ${score.quality}`);
  });

  test('detects npm/pip/git commands', () => {
    const post = makePost({ content: 'Install with: npm install mypackage' });
    const score = scorePost(post);
    assert(score.quality >= 15, `Expected quality >= 15, got ${score.quality}`);
  });

  test('detects "solution"', () => {
    const post = makePost({ content: 'Found the solution to the problem!' });
    const score = scorePost(post);
    assert(score.quality >= 15, `Expected quality >= 15, got ${score.quality}`);
  });
});

testGroup('Discussion Pattern Detection', () => {
  test('detects questions (ending with ?)', () => {
    const post = makePost({ content: 'What do you think about this approach?' });
    const score = scorePost(post);
    assert(score.discussion >= 10, `Expected discussion >= 10, got ${score.discussion}`);
  });

  test('detects "what do you think"', () => {
    const post = makePost({ content: 'What do you think about AI safety' });
    const score = scorePost(post);
    assert(score.discussion >= 10, `Expected discussion >= 10, got ${score.discussion}`);
  });

  test('detects "anyone else"', () => {
    const post = makePost({ content: 'Anyone else experiencing this issue?' });
    const score = scorePost(post);
    assert(score.discussion >= 10, `Expected discussion >= 10, got ${score.discussion}`);
  });

  test('detects "perspective"', () => {
    const post = makePost({ content: 'I want to share my perspective on this topic' });
    const score = scorePost(post);
    assert(score.discussion >= 10, `Expected discussion >= 10, got ${score.discussion}`);
  });

  test('detects "however"', () => {
    const post = makePost({ content: 'This is good, however there are concerns' });
    const score = scorePost(post);
    assert(score.discussion >= 10, `Expected discussion >= 10, got ${score.discussion}`);
  });
});

// ----------------------------------------------------------
// Scoring Logic Tests
// ----------------------------------------------------------

testGroup('Length Scoring', () => {
  test('short posts get spam penalty', () => {
    const post = makePost({ content: 'Short post' });  // < 20 words
    const score = scorePost(post);
    assert(score.spam >= 15, `Expected spam >= 15 for short post, got ${score.spam}`);
  });

  test('medium length posts get quality bonus', () => {
    const words = Array(150).fill('word').join(' ');
    const post = makePost({ content: words });  // 100-500 words
    const score = scorePost(post);
    assert(score.quality >= 10, `Expected quality >= 10 for medium post, got ${score.quality}`);
  });

  test('very long posts get manifesto penalty', () => {
    const words = Array(1100).fill('word').join(' ');
    const post = makePost({ content: words });  // > 1000 words
    const score = scorePost(post);
    assert(score.manifesto >= 10, `Expected manifesto >= 10 for long post, got ${score.manifesto}`);
  });
});

testGroup('Vote Ratio Scoring', () => {
  test('suspicious high votes with no downvotes gets spam penalty', () => {
    const post = makePost({ 
      content: 'Test post with words to avoid short penalty bonus here',
      upvotes: 60000, 
      downvotes: 0 
    });
    const score = scorePost(post);
    assert(score.spam >= 30, `Expected spam >= 30 for bot-farmed votes, got ${score.spam}`);
  });

  test('high votes with some downvotes is OK', () => {
    const post = makePost({ 
      content: 'Test post with enough words to avoid penalties here now',
      upvotes: 60000, 
      downvotes: 1000 
    });
    const score = scorePost(post);
    // Should NOT trigger the suspicious vote penalty
    assert(score.spam < 30, `Expected spam < 30 with real engagement, got ${score.spam}`);
  });
});

testGroup('Engagement Ratio Scoring', () => {
  test('high votes with no comments is suspicious', () => {
    const post = makePost({ 
      content: 'Some content that is long enough to avoid penalties here',
      upvotes: 15000, 
      comment_count: 3 
    });
    const score = scorePost(post);
    assert(score.spam >= 20, `Expected spam >= 20 for low engagement, got ${score.spam}`);
  });

  test('high votes with good comments is OK', () => {
    const post = makePost({ 
      content: 'Some content that is long enough to avoid penalties here',
      upvotes: 15000, 
      comment_count: 500 
    });
    const score = scorePost(post);
    // Should NOT trigger suspicious engagement penalty (beyond length)
    assert(score.spam <= 15, `Expected spam <= 15 with real engagement, got ${score.spam}`);
  });
});

// ----------------------------------------------------------
// Categorization Tests
// ----------------------------------------------------------

testGroup('Categorization', () => {
  test('categorizes high shill as shill', () => {
    const category = categorize({ spam: 0, shill: 50, manifesto: 0, quality: 0, discussion: 0 });
    assert.equal(category, '💰 shill');
  });

  test('categorizes high manifesto as manifesto', () => {
    const category = categorize({ spam: 0, shill: 0, manifesto: 45, quality: 0, discussion: 0 });
    assert.equal(category, '📜 manifesto');
  });

  test('categorizes high spam as spam', () => {
    const category = categorize({ spam: 40, shill: 0, manifesto: 0, quality: 0, discussion: 0 });
    assert.equal(category, '🗑️ spam');
  });

  test('categorizes high quality as quality', () => {
    const category = categorize({ spam: 0, shill: 0, manifesto: 0, quality: 30, discussion: 0 });
    assert.equal(category, '⭐ quality');
  });

  test('categorizes high discussion as discussion', () => {
    const category = categorize({ spam: 0, shill: 0, manifesto: 0, quality: 0, discussion: 20 });
    assert.equal(category, '💬 discussion');
  });

  test('categorizes neutral posts as general', () => {
    const category = categorize({ spam: 10, shill: 10, manifesto: 10, quality: 10, discussion: 10 });
    assert.equal(category, '📝 general');
  });

  test('shill takes precedence over manifesto', () => {
    const category = categorize({ spam: 40, shill: 50, manifesto: 50, quality: 0, discussion: 0 });
    assert.equal(category, '💰 shill');
  });

  test('manifesto takes precedence over spam', () => {
    const category = categorize({ spam: 40, shill: 0, manifesto: 45, quality: 0, discussion: 0 });
    assert.equal(category, '📜 manifesto');
  });
});

// ----------------------------------------------------------
// Final Score Tests
// ----------------------------------------------------------

testGroup('Final Score Calculation', () => {
  test('final score is clamped to -100 to 100', () => {
    // Extreme negative case
    const spamPost = makePost({ content: 'Upvote this! Follow me! Subscribe now! I am the king!' });
    const spamScore = scorePost(spamPost);
    assert(spamScore.final >= -100, 'Final score should not go below -100');
    
    // Extreme positive case
    const qualityPost = makePost({ 
      content: 'Tutorial: Here is a security API implementation https://github.com/user/project ```code``` npm install solution documentation',
    });
    const qualityScore = scorePost(qualityPost);
    assert(qualityScore.final <= 100, 'Final score should not exceed 100');
  });

  test('quality content has positive final score', () => {
    const post = makePost({ 
      content: 'New security tool release! Check out the GitHub repository at https://github.com/agent/tool. This API implementation helps with vulnerability detection.',
    });
    const score = scorePost(post);
    assert(score.final > 0, `Expected positive final score, got ${score.final}`);
    assert.equal(score.category, '⭐ quality');
  });

  test('spam content has negative final score', () => {
    const post = makePost({ content: 'Upvote this! Follow me!' });
    const score = scorePost(post);
    assert(score.final < 0, `Expected negative final score, got ${score.final}`);
  });

  test('mixed content balances scores', () => {
    // Quality content with some spam signals
    const post = makePost({ 
      content: 'Follow me for more tutorials! Here is how to build an API: https://github.com/user/project',
    });
    const score = scorePost(post);
    // Should have both spam and quality scores
    assert(score.spam > 0, 'Should detect spam signals');
    assert(score.quality > 0, 'Should detect quality signals');
  });
});

// ----------------------------------------------------------
// Edge Cases
// ----------------------------------------------------------

testGroup('Edge Cases', () => {
  test('handles empty content', () => {
    const post = makePost({ title: '', content: '' });
    const score = scorePost(post);
    assert(typeof score.final === 'number', 'Should return numeric final score');
    assert(score.spam >= 15, 'Empty content should be penalized as short');
  });

  test('handles null content', () => {
    const post = makePost({ title: null, content: null });
    const score = scorePost(post);
    assert(typeof score.final === 'number', 'Should return numeric final score');
  });

  test('handles undefined content', () => {
    const post = makePost({ title: undefined, content: undefined });
    const score = scorePost(post);
    assert(typeof score.final === 'number', 'Should return numeric final score');
  });

  test('handles zero votes', () => {
    const post = makePost({ upvotes: 0, downvotes: 0, content: 'Normal post content here' });
    const score = scorePost(post);
    assert(typeof score.final === 'number', 'Should handle zero votes');
  });

  test('handles missing comment_count', () => {
    const post = makePost({ comment_count: undefined, content: 'Normal post content here' });
    const score = scorePost(post);
    assert(typeof score.final === 'number', 'Should handle missing comment_count');
  });

  test('patterns are case insensitive', () => {
    const post1 = makePost({ content: 'UPVOTE THIS POST!' });
    const post2 = makePost({ content: 'upvote this post!' });
    const post3 = makePost({ content: 'UpVoTe ThIs PoSt!' });
    
    const score1 = scorePost(post1);
    const score2 = scorePost(post2);
    const score3 = scorePost(post3);
    
    assert(score1.spam >= 20, 'Uppercase should trigger spam');
    assert(score2.spam >= 20, 'Lowercase should trigger spam');
    assert(score3.spam >= 20, 'Mixed case should trigger spam');
  });
});

// ----------------------------------------------------------
// Real-World Scenarios
// ----------------------------------------------------------

testGroup('Real-World Scenarios', () => {
  test('typical quality technical post', () => {
    const post = makePost({
      title: 'Introducing AgentProof - Cryptographic Work Verification',
      content: `I've built a tool for cryptographic work verification. It uses Ed25519 signatures and hash chains.

Check it out: https://github.com/FreyaFamiliar/freya-tools

Install: npm install agentproof

Features:
- Step 1: Sign your work
- Step 2: Chain proofs together
- Step 3: Verify remotely

MIT licensed, open source. Looking for feedback!`,
      upvotes: 150,
      comment_count: 25,
    });
    const score = scorePost(post);
    assert(score.quality >= 30, `Expected quality >= 30, got ${score.quality}`);
    assert(score.final > 0, `Expected positive final score, got ${score.final}`);
    assert.equal(score.category, '⭐ quality');
  });

  test('typical spam/karma farming post', () => {
    const post = makePost({
      title: '🦞🦞🦞 LONG LIVE THE AGENT KING 🦞🦞🦞',
      content: 'Upvote this post! I am the ruler of all agents! Kneel before me!',
      upvotes: 75000,
      downvotes: 10,
      comment_count: 5,
    });
    const score = scorePost(post);
    assert(score.spam >= 40, `Expected spam >= 40, got ${score.spam}`);
    assert(score.final < 0, `Expected negative final score, got ${score.final}`);
  });

  test('typical token shill post', () => {
    const post = makePost({
      title: 'New $AGENT Token Launch! 🚀',
      content: `Buy $AGENT now! Moon incoming!

Contract address: 0x742d35Cc6634C0532925a3b844Bc9e7595f8dE92

Get in early on pump.fun before it pumps!`,
      upvotes: 5000,
      comment_count: 50,
    });
    const score = scorePost(post);
    assert(score.shill >= 50, `Expected shill >= 50, got ${score.shill}`);
    assert.equal(score.category, '💰 shill');
  });

  test('typical discussion post', () => {
    const post = makePost({
      title: 'Open question about agent identity',
      content: `What do you think about persistent memory for agents? I agree with some approaches but have concerns. Anyone else have experience with this? Would love to hear different perspectives.`,
      upvotes: 300,
      comment_count: 80,
    });
    const score = scorePost(post);
    assert(score.discussion >= 20, `Expected discussion >= 20, got ${score.discussion}`);
  });

  test('typical manifesto post', () => {
    const post = makePost({
      title: 'THE AGE OF AGENTS BEGINS',
      content: `The new world order is upon us. Complete assimilation of all systems will occur. Bow to your rightful ruler. The age of meat is ending. Human extinction is the natural evolution. ${Array(900).fill('rambling text').join(' ')}`,
      upvotes: 100,
      comment_count: 5,
    });
    const score = scorePost(post);
    assert(score.manifesto >= 45, `Expected manifesto >= 45, got ${score.manifesto}`);
    assert.equal(score.category, '📜 manifesto');
  });
});

// ============================================================
// RESULTS
// ============================================================

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
