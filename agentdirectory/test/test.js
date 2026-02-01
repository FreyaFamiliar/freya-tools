/**
 * AgentDirectory Tests
 */

const { Directory, createAgentEntry, validateEntry, CapabilityCategories } = require('../src');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

// Tests

test('createAgentEntry creates valid entry', () => {
  const entry = createAgentEntry({
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent'
  });
  
  assert(entry.id === 'test-agent', 'Should have id');
  assert(entry.name === 'Test Agent', 'Should have name');
  assert(entry.schemaVersion === '1.0', 'Should have schema version');
  assert(entry.registeredAt, 'Should have registeredAt');
});

test('createAgentEntry requires id and name', () => {
  let threw = false;
  try {
    createAgentEntry({ name: 'No ID' });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Should throw without id');
});

test('validateEntry catches invalid entries', () => {
  const result = validateEntry({ name: 'Missing ID' });
  assert(!result.valid, 'Should be invalid');
  assert(result.errors.includes('Missing required field: id'), 'Should report missing id');
});

test('validateEntry accepts valid entries', () => {
  const entry = createAgentEntry({
    id: 'valid-agent',
    name: 'Valid Agent'
  });
  const result = validateEntry(entry);
  assert(result.valid, 'Should be valid: ' + result.errors.join(', '));
});

test('Directory add and get', () => {
  const dir = new Directory();
  
  const result = dir.add({
    id: 'test-1',
    name: 'Test One',
    description: 'First test agent'
  });
  
  assert(result.success, 'Should add successfully');
  
  const agent = dir.get('test-1');
  assert(agent, 'Should retrieve agent');
  assert(agent.name === 'Test One', 'Should have correct name');
});

test('Directory rejects duplicates', () => {
  const dir = new Directory();
  
  dir.add({ id: 'dup', name: 'First' });
  const result = dir.add({ id: 'dup', name: 'Second' });
  
  assert(!result.success, 'Should reject duplicate');
  assert(result.error.includes('already exists'), 'Should report duplicate');
});

test('Directory list returns all agents', () => {
  const dir = new Directory();
  
  dir.add({ id: 'a', name: 'A' });
  dir.add({ id: 'b', name: 'B' });
  dir.add({ id: 'c', name: 'C' });
  
  const list = dir.list();
  assert(list.length === 3, 'Should have 3 agents');
});

test('Directory search by text', () => {
  const dir = new Directory();
  
  dir.add({ id: 'coder', name: 'Code Helper', description: 'Helps with coding' });
  dir.add({ id: 'writer', name: 'Writing Assistant', description: 'Helps with writing' });
  
  const results = dir.search({ text: 'coding' });
  assert(results.length === 1, 'Should find 1 agent');
  assert(results[0].id === 'coder', 'Should find coder');
});

test('Directory search by capability', () => {
  const dir = new Directory();
  
  dir.add({
    id: 'sec-agent',
    name: 'Security Agent',
    capabilities: [{ category: 'security', skills: ['auditing'] }]
  });
  dir.add({
    id: 'code-agent',
    name: 'Code Agent',
    capabilities: [{ category: 'coding', skills: ['javascript'] }]
  });
  
  const results = dir.search({ capability: 'security' });
  assert(results.length === 1, 'Should find 1 agent');
  assert(results[0].id === 'sec-agent', 'Should find security agent');
});

test('Directory remove', () => {
  const dir = new Directory();
  
  dir.add({ id: 'remove-me', name: 'Remove Me' });
  assert(dir.get('remove-me'), 'Should exist before remove');
  
  const result = dir.remove('remove-me');
  assert(result.success, 'Should remove successfully');
  assert(!dir.get('remove-me'), 'Should not exist after remove');
});

test('Directory update', () => {
  const dir = new Directory();
  
  dir.add({ id: 'updatable', name: 'Original Name' });
  
  const result = dir.update('updatable', { name: 'Updated Name' });
  assert(result.success, 'Should update successfully');
  
  const agent = dir.get('updatable');
  assert(agent.name === 'Updated Name', 'Should have new name');
  assert(agent.id === 'updatable', 'Should keep same id');
});

test('Directory stats', () => {
  const dir = new Directory();
  
  dir.add({
    id: 'a',
    name: 'A',
    capabilities: [{ category: 'coding' }]
  });
  dir.add({
    id: 'b',
    name: 'B',
    capabilities: [{ category: 'coding' }, { category: 'security' }]
  });
  
  const stats = dir.stats();
  assert(stats.total === 2, 'Should have 2 total');
  assert(stats.byCapability.coding === 2, 'Should count coding twice');
  assert(stats.byCapability.security === 1, 'Should count security once');
});

test('Directory export and import', () => {
  const dir1 = new Directory();
  dir1.add({ id: 'export-test', name: 'Export Test' });
  
  const exported = dir1.export();
  assert(exported.agents['export-test'], 'Should export agent');
  
  const dir2 = new Directory();
  const importResult = dir2.import(exported);
  
  assert(importResult.added === 1, 'Should import 1 agent');
  assert(dir2.get('export-test'), 'Should have imported agent');
});

// Summary
console.log('\n---');
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
