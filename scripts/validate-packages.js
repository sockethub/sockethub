#!/usr/bin/env bun
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';

/**
 * Validates that package.json entry points (main, exports, types, bin) 
 * reference files that are included in the published package.
 * 
 * Two modes:
 * 1. Browser packages (with build scripts to dist/) - should point to .js files in dist/
 * 2. Bun-only packages (TypeScript source) - can point to .ts files if src/ is included
 */

let errors = 0;

function validatePackage(pkgPath) {
  const pkgDir = dirname(pkgPath);
  const pkgData = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const { name, main, exports, types, bin, files = [], scripts = {} } = pkgData;

  console.log(`\nValidating ${name || pkgPath}...`);

  // Detect if this is a browser-targeted package (has build scripts to dist/)
  const isBrowserPackage = scripts.build && 
    (scripts.build.includes('--target=browser') || scripts.build.includes('dist/'));

  // If no files array, everything is included (npm default)
  const includesEverything = files.length === 0;

  function isFileIncluded(filePath) {
    if (includesEverything) return true;
    
    // Normalize path - remove leading ./
    const normalized = filePath.replace(/^\.\//, '');
    
    // Check if path starts with any included directory/file pattern
    return files.some(pattern => {
      const normalizedPattern = pattern.replace(/^\.\//, '').replace(/\/$/, '');
      return normalized.startsWith(normalizedPattern + '/') || 
             normalized === normalizedPattern ||
             normalized.startsWith(normalizedPattern);
    });
  }

  function checkPath(fieldName, path) {
    if (!path) return;
    
    const normalizedPath = path.replace(/^\.\//, '');
    
    // For browser packages, TypeScript files should be compiled
    if (isBrowserPackage && normalizedPath.endsWith('.ts') && !normalizedPath.endsWith('.d.ts')) {
      console.error(`  ❌ "${fieldName}": "${path}" - Browser package should point to compiled .js file`);
      console.error(`     This is a browser-targeted package (has build:browser script)`);
      console.error(`     Hint: Point to ./dist/[filename].js instead`);
      errors++;
      return;
    }

    // Check if file would be included in published package
    if (!isFileIncluded(normalizedPath)) {
      console.error(`  ❌ "${fieldName}": "${path}" - File not included in "files" array`);
      console.error(`     "files": ${JSON.stringify(files)}`);
      errors++;
      return;
    }

    // Check if file actually exists
    const fullPath = join(pkgDir, normalizedPath);
    if (!existsSync(fullPath)) {
      console.warn(`  ⚠️  "${fieldName}": "${path}" - File doesn't exist (may not be built yet)`);
      return;
    }

    const typeInfo = isBrowserPackage ? ' [browser build]' : ' [bun runtime]';
    console.log(`  ✅ "${fieldName}": "${path}"${typeInfo}`);
  }

  // Validate main
  if (main) {
    checkPath('main', main);
  }

  // Validate types
  if (types) {
    checkPath('types', types);
  }

  // Validate bin
  if (bin) {
    if (typeof bin === 'string') {
      checkPath('bin', bin);
    } else {
      Object.entries(bin).forEach(([name, path]) => {
        checkPath(`bin.${name}`, path);
      });
    }
  }

  // Validate exports (simplified - could be more complex)
  if (exports) {
    if (typeof exports === 'string') {
      checkPath('exports', exports);
    } else if (typeof exports === 'object') {
      function checkExports(obj, prefix = 'exports') {
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'string') {
            checkPath(`${prefix}.${key}`, value);
          } else if (typeof value === 'object') {
            checkExports(value, `${prefix}.${key}`);
          }
        });
      }
      checkExports(exports);
    }
  }
}

// Find all package.json files in packages/
const packagesDir = resolve(import.meta.dir, '../packages');
const packages = readdirSync(packagesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => join(packagesDir, dirent.name, 'package.json'))
  .filter(path => existsSync(path));

console.log(`Found ${packages.length} packages to validate\n`);
console.log('Legend:');
console.log('  [browser build] - Package builds to dist/ for browser use');
console.log('  [bun runtime]   - Package ships TypeScript source for Bun runtime');

packages.forEach(validatePackage);

if (errors > 0) {
  console.error(`\n❌ Validation failed with ${errors} error(s)`);
  process.exit(1);
} else {
  console.log('\n✅ All packages valid!');
}
