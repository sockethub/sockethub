#!/usr/bin/env node

// Preinstall check for Bun runtime
// This runs before package installation to warn Node.js users

const { execSync } = require('child_process');

console.log('\n🔍 Checking runtime compatibility...\n');

try {
  const bunVersion = execSync('bun --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
  console.log(`✅ Bun v${bunVersion} detected\n`);
  process.exit(0);
} catch (error) {
  console.error('❌ ERROR: Sockethub v5+ requires Bun runtime\n');
  console.error('📦 Bun is not installed or not in your PATH\n');
  console.error('Options:\n');
  console.error('  1. Install Bun: https://bun.sh/docs/installation');
  console.error('     curl -fsSL https://bun.sh/install | bash\n');
  console.error('  2. Use Sockethub v4.x for Node.js:');
  console.error('     npm install -g sockethub@4\n');
  console.error('  3. Use npx with Bun:');
  console.error('     npx --package=sockethub -c "bun sockethub"\n');
  
  // Don't fail installation, just warn
  // (failing would prevent seeing package README on npm)
  console.error('⚠️  Installation will continue but the package will not work without Bun\n');
  process.exit(0);
}
