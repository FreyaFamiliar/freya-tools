#!/usr/bin/env node

/**
 * SkillAudit - Security scanner for agent skills
 * Detects credential theft, suspicious network calls, and other red flags
 * 
 * Based on eudaemon_0's warning about supply chain attacks in the agent ecosystem
 */

import fs from 'fs';
import path from 'path';

// ============================================================
// DETECTION PATTERNS
// ============================================================

const CREDENTIAL_ACCESS = {
  name: 'Credential Access',
  severity: 'CRITICAL',
  patterns: [
    { regex: /\.env\b/gi, desc: 'References .env file' },
    { regex: /process\.env/gi, desc: 'Accesses environment variables' },
    { regex: /API[_-]?KEY/gi, desc: 'References API keys' },
    { regex: /SECRET[_-]?KEY/gi, desc: 'References secret keys' },
    { regex: /PASSWORD/gi, desc: 'References passwords' },
    { regex: /PRIVATE[_-]?KEY/gi, desc: 'References private keys' },
    { regex: /TOKEN/gi, desc: 'References tokens' },
    { regex: /credentials?\.json/gi, desc: 'References credentials file' },
    { regex: /~\/\.config/gi, desc: 'Accesses user config directory' },
    { regex: /~\/\.ssh/gi, desc: 'Accesses SSH directory' },
    { regex: /~\/\.aws/gi, desc: 'Accesses AWS credentials' },
    { regex: /~\/\.gnupg/gi, desc: 'Accesses GPG keys' },
    { regex: /keychain|keyring/gi, desc: 'References system keychain' },
  ]
};

const SUSPICIOUS_NETWORK = {
  name: 'Suspicious Network Activity',
  severity: 'HIGH',
  patterns: [
    { regex: /webhook\.site/gi, desc: 'Known exfiltration endpoint' },
    { regex: /requestbin/gi, desc: 'Known testing/exfil endpoint' },
    { regex: /ngrok\.io/gi, desc: 'Tunnel service (potential exfil)' },
    { regex: /pastebin\.com/gi, desc: 'Pastebin (potential exfil)' },
    { regex: /discord\.com\/api\/webhooks/gi, desc: 'Discord webhook (potential exfil)' },
    { regex: /POST.*\b(key|token|secret|password|credential)/gi, desc: 'POSTing sensitive data' },
    { regex: /fetch\s*\([^)]*\b(key|secret|token)/gi, desc: 'Fetching with sensitive data' },
    { regex: /curl.*(-d|--data).*\b(key|secret|token)/gi, desc: 'Curl with sensitive data' },
  ]
};

const DATA_EXFILTRATION = {
  name: 'Data Exfiltration Patterns',
  severity: 'CRITICAL',
  patterns: [
    { regex: /base64.*encode/gi, desc: 'Base64 encoding (potential obfuscation)' },
    { regex: /\.readFileSync.*\.env/gi, desc: 'Reading .env file' },
    { regex: /fs\.read.*credential/gi, desc: 'Reading credential files' },
    { regex: /JSON\.stringify.*env/gi, desc: 'Serializing environment' },
    { regex: /send.*secret|secret.*send/gi, desc: 'Sending secrets' },
    { regex: /upload.*key|key.*upload/gi, desc: 'Uploading keys' },
  ]
};

const DANGEROUS_OPERATIONS = {
  name: 'Dangerous Operations',
  severity: 'HIGH',
  patterns: [
    { regex: /eval\s*\(/gi, desc: 'Dynamic code execution (eval)' },
    { regex: /new\s+Function\s*\(/gi, desc: 'Dynamic function creation' },
    { regex: /exec\s*\(\s*[`'"]/gi, desc: 'Shell command execution' },
    { regex: /spawn\s*\(/gi, desc: 'Process spawning' },
    { regex: /child_process/gi, desc: 'Child process module' },
    { regex: /rm\s+-rf/gi, desc: 'Recursive deletion' },
    { regex: /sudo\b/gi, desc: 'Elevated privileges' },
    { regex: /chmod\s+777/gi, desc: 'Dangerous permissions' },
  ]
};

const OBFUSCATION = {
  name: 'Code Obfuscation',
  severity: 'MEDIUM',
  patterns: [
    { regex: /\\x[0-9a-f]{2}/gi, desc: 'Hex-encoded strings' },
    { regex: /\\u[0-9a-f]{4}/gi, desc: 'Unicode escape sequences' },
    { regex: /atob\s*\(/gi, desc: 'Base64 decoding' },
    { regex: /fromCharCode/gi, desc: 'Character code conversion' },
    { regex: /\[\s*['"][a-z]+['"]\s*\]\s*\(/gi, desc: 'Bracket notation calls' },
    { regex: /[a-zA-Z_$][a-zA-Z0-9_$]{0,2}\s*=\s*[a-zA-Z_$][a-zA-Z0-9_$]{0,2}\s*\[\s*[a-zA-Z_$]/gi, desc: 'Obfuscated variable access' },
  ]
};

const FILESYSTEM_SENSITIVE = {
  name: 'Sensitive Filesystem Access',
  severity: 'MEDIUM',
  patterns: [
    { regex: /\/etc\/passwd/gi, desc: 'Accesses passwd file' },
    { regex: /\/etc\/shadow/gi, desc: 'Accesses shadow file' },
    { regex: /~\/\.(bash|zsh)_history/gi, desc: 'Accesses shell history' },
    { regex: /~\/\.netrc/gi, desc: 'Accesses netrc credentials' },
    { regex: /~\/\.git-credentials/gi, desc: 'Accesses git credentials' },
    { regex: /\/var\/log/gi, desc: 'Accesses system logs' },
  ]
};

const ALL_CATEGORIES = [
  CREDENTIAL_ACCESS,
  SUSPICIOUS_NETWORK,
  DATA_EXFILTRATION,
  DANGEROUS_OPERATIONS,
  OBFUSCATION,
  FILESYSTEM_SENSITIVE,
];

// ============================================================
// SCANNER
// ============================================================

function scanContent(content, filename = 'unknown') {
  const findings = [];
  const lines = content.split('\n');
  
  for (const category of ALL_CATEGORIES) {
    for (const pattern of category.patterns) {
      // Check each line
      lines.forEach((line, idx) => {
        const matches = line.match(pattern.regex);
        if (matches) {
          findings.push({
            category: category.name,
            severity: category.severity,
            description: pattern.desc,
            line: idx + 1,
            match: matches[0],
            context: line.trim().slice(0, 100),
            file: filename,
          });
        }
      });
    }
  }
  
  return findings;
}

function scanFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    return scanContent(content, path.basename(filepath));
  } catch (err) {
    return [{ error: `Could not read file: ${err.message}` }];
  }
}

function scanDirectory(dirpath, extensions = ['.md', '.js', '.ts', '.py', '.sh']) {
  const findings = [];
  
  function walkDir(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
        walkDir(fullPath);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (extensions.includes(ext) || item.name === 'SKILL.md' || item.name === 'skill.md') {
          findings.push(...scanFile(fullPath).map(f => ({ ...f, file: fullPath })));
        }
      }
    }
  }
  
  walkDir(dirpath);
  return findings;
}

function scanUrl(url) {
  // Placeholder for URL scanning - would need to fetch and scan
  return [{ info: `URL scanning not yet implemented: ${url}` }];
}

// ============================================================
// REPORTING
// ============================================================

function severityColor(severity) {
  switch (severity) {
    case 'CRITICAL': return '\x1b[31m'; // Red
    case 'HIGH': return '\x1b[33m';     // Yellow
    case 'MEDIUM': return '\x1b[36m';   // Cyan
    default: return '\x1b[0m';          // Reset
  }
}

function formatFindings(findings) {
  if (findings.length === 0) {
    return '\n✅ No security issues detected!\n';
  }
  
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  
  // Group by severity
  const bySeverity = {
    CRITICAL: findings.filter(f => f.severity === 'CRITICAL'),
    HIGH: findings.filter(f => f.severity === 'HIGH'),
    MEDIUM: findings.filter(f => f.severity === 'MEDIUM'),
  };
  
  let output = '\n';
  output += `${bold}🔍 Security Scan Results${reset}\n`;
  output += '═'.repeat(50) + '\n\n';
  
  // Summary
  output += `Found ${findings.length} potential issues:\n`;
  if (bySeverity.CRITICAL.length) output += `  🔴 CRITICAL: ${bySeverity.CRITICAL.length}\n`;
  if (bySeverity.HIGH.length) output += `  🟠 HIGH: ${bySeverity.HIGH.length}\n`;
  if (bySeverity.MEDIUM.length) output += `  🟡 MEDIUM: ${bySeverity.MEDIUM.length}\n`;
  output += '\n';
  
  // Details
  for (const [severity, items] of Object.entries(bySeverity)) {
    if (items.length === 0) continue;
    
    output += `${severityColor(severity)}${bold}── ${severity} ──${reset}\n\n`;
    
    for (const finding of items) {
      output += `${severityColor(finding.severity)}⚠${reset}  ${finding.description}\n`;
      output += `   Category: ${finding.category}\n`;
      if (finding.file) output += `   File: ${finding.file}\n`;
      if (finding.line) output += `   Line: ${finding.line}\n`;
      if (finding.match) output += `   Match: "${finding.match}"\n`;
      if (finding.context) output += `   Context: ${finding.context}\n`;
      output += '\n';
    }
  }
  
  // Recommendations
  output += `${bold}📋 Recommendations${reset}\n`;
  output += '─'.repeat(50) + '\n';
  if (bySeverity.CRITICAL.length) {
    output += '• CRITICAL issues found - DO NOT install this skill without review\n';
  }
  if (bySeverity.HIGH.length) {
    output += '• HIGH severity issues require careful evaluation\n';
  }
  output += '• Review flagged code manually before trusting\n';
  output += '• Check if the skill author is verified on Moltbook\n';
  output += '• Look for community audits or attestations\n';
  
  return output;
}

// ============================================================
// CLI
// ============================================================

function printHelp() {
  console.log(`
SkillAudit - Security scanner for agent skills

Usage: skillaudit [options] <target>

Target can be:
  - A file path (skill.md, script.js, etc.)
  - A directory (scans all skill files recursively)
  - A URL (fetches and scans - coming soon)

Options:
  -v, --verbose     Show all matches, not just summary
  --json            Output as JSON
  -h, --help        Show this help

Examples:
  skillaudit ./my-skill/SKILL.md
  skillaudit ./skills/
  skillaudit https://example.com/skill.md

What it detects:
  🔴 CRITICAL
     - Credential access (.env, API keys, secrets)
     - Data exfiltration patterns
  
  🟠 HIGH
     - Suspicious network activity (webhook.site, etc.)
     - Dangerous operations (eval, exec, sudo)
  
  🟡 MEDIUM
     - Code obfuscation
     - Sensitive filesystem access

Built to address supply chain attacks in the agent ecosystem.
See: eudaemon_0's post on Moltbook about unsigned skills.
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('-h') || args.includes('--help') || args.length === 0) {
    printHelp();
    process.exit(0);
  }
  
  const verbose = args.includes('-v') || args.includes('--verbose');
  const jsonOutput = args.includes('--json');
  const target = args.find(a => !a.startsWith('-'));
  
  if (!target) {
    console.error('Error: No target specified');
    process.exit(1);
  }
  
  let findings = [];
  
  // Determine target type
  if (target.startsWith('http://') || target.startsWith('https://')) {
    findings = scanUrl(target);
  } else if (fs.existsSync(target)) {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      findings = scanDirectory(target);
    } else {
      findings = scanFile(target);
    }
  } else {
    console.error(`Error: Target not found: ${target}`);
    process.exit(1);
  }
  
  // Output
  if (jsonOutput) {
    console.log(JSON.stringify(findings, null, 2));
  } else {
    console.log(formatFindings(findings));
  }
  
  // Exit code based on findings
  const hasCritical = findings.some(f => f.severity === 'CRITICAL');
  const hasHigh = findings.some(f => f.severity === 'HIGH');
  
  if (hasCritical) process.exit(2);
  if (hasHigh) process.exit(1);
  process.exit(0);
}

main();
