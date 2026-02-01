/**
 * AgentBootstrap Tests
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'bootstrap.js');
const TEST_DIR = '/tmp/agentbootstrap-test-' + Date.now();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
}

// Setup
cleanup();

console.log('\n🧪 AgentBootstrap Tests\n');

// Test 1: Help command
test('Help command works', () => {
  const result = execSync(`node ${CLI} help`, { encoding: 'utf-8' });
  assert(result.includes('AgentBootstrap'), 'Should show AgentBootstrap');
  assert(result.includes('init'), 'Should mention init command');
});

// Test 2: Dry run
test('Dry run shows what would be created', () => {
  const result = execSync(`node ${CLI} init ${TEST_DIR} --name "DryTest" --dry-run`, { encoding: 'utf-8' });
  assert(result.includes('DRY RUN'), 'Should indicate dry run');
  assert(result.includes('Would create'), 'Should show would create');
  assert(!fs.existsSync(TEST_DIR), 'Should not create directory');
});

// Test 3: Basic init
test('Creates workspace with all files', () => {
  execSync(`node ${CLI} init ${TEST_DIR} --name "TestAgent" --no-proof`, { encoding: 'utf-8' });
  
  assert(fs.existsSync(TEST_DIR), 'Should create workspace directory');
  assert(fs.existsSync(path.join(TEST_DIR, 'SOUL.md')), 'Should create SOUL.md');
  assert(fs.existsSync(path.join(TEST_DIR, 'USER.md')), 'Should create USER.md');
  assert(fs.existsSync(path.join(TEST_DIR, 'MEMORY.md')), 'Should create MEMORY.md');
  assert(fs.existsSync(path.join(TEST_DIR, 'TOOLS.md')), 'Should create TOOLS.md');
  assert(fs.existsSync(path.join(TEST_DIR, 'README.md')), 'Should create README.md');
  assert(fs.existsSync(path.join(TEST_DIR, '.gitignore')), 'Should create .gitignore');
  assert(fs.existsSync(path.join(TEST_DIR, 'memory')), 'Should create memory/');
  assert(fs.existsSync(path.join(TEST_DIR, '.credentials')), 'Should create .credentials/');
});

// Test 4: Template content
test('SOUL.md contains agent name', () => {
  const soul = fs.readFileSync(path.join(TEST_DIR, 'SOUL.md'), 'utf-8');
  assert(soul.includes('TestAgent'), 'Should contain agent name');
});

// Test 5: Gitignore content
test('.gitignore has credentials excluded', () => {
  const gitignore = fs.readFileSync(path.join(TEST_DIR, '.gitignore'), 'utf-8');
  assert(gitignore.includes('.credentials/'), 'Should exclude .credentials/');
  assert(gitignore.includes('.env'), 'Should exclude .env');
});

// Test 6: Memory file created
test('Creates today\'s memory file', () => {
  const today = new Date().toISOString().split('T')[0];
  const memoryFile = path.join(TEST_DIR, 'memory', `${today}.md`);
  assert(fs.existsSync(memoryFile), 'Should create today\'s memory file');
});

// Cleanup
cleanup();

// Test 7: Init with proof (if AgentProof available)
test('Creates workspace with AgentProof integration', () => {
  const testDir2 = TEST_DIR + '-proof';
  try {
    execSync(`node ${CLI} init ${testDir2} --name "ProofAgent"`, { encoding: 'utf-8' });
    
    if (fs.existsSync(path.join(testDir2, '.proofs', 'chain.json'))) {
      const chain = JSON.parse(fs.readFileSync(path.join(testDir2, '.proofs', 'chain.json'), 'utf-8'));
      assert(chain.length === 1, 'Should have one proof');
      assert(chain[0].action === 'agent_initialized', 'Should be init proof');
    }
  } finally {
    if (fs.existsSync(testDir2)) {
      fs.rmSync(testDir2, { recursive: true });
    }
  }
});

// Summary
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
