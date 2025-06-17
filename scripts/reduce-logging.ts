#!/usr/bin/env ts-node

/**
 * Script to reduce verbose logging across the codebase
 * Makes logs more concise and production-ready
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const EXCLUDED_DIRS = ['node_modules', '.next', '.git', 'dist', 'build'];
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

interface LogReplacement {
  pattern: RegExp;
  replacement: string;
}

const replacements: LogReplacement[] = [
  // Remove verbose Auth logs
  {
    pattern: /console\.log\(\s*['"`]\[AuthContext\][^'"`]*['"`]\s*[,)].*?\)/g,
    replacement: '// Auth check removed for conciseness'
  },
  // Simplify error logs
  {
    pattern: /console\.error\(\s*['"`]([^:]+):\s*['"`],\s*error\s*\)/g,
    replacement: 'logger.error("$1", error)'
  },
  // Remove debug logs in production
  {
    pattern: /console\.log\(\s*['"`]DEBUG:[^'"`]*['"`].*?\)/g,
    replacement: '// Debug log removed'
  },
  // Simplify API logs
  {
    pattern: /console\.log\(\s*['"`]\[API\][^'"`]*['"`].*?\)/g,
    replacement: '// API log removed'
  }
];

function processFile(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf8');
  let modified = false;
  
  replacements.forEach(({ pattern, replacement }) => {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      modified = true;
      content = newContent;
    }
  });
  
  if (modified) {
    writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
  }
  
  return modified;
}

function processDirectory(dirPath: string): void {
  const items = readdirSync(dirPath);
  
  items.forEach(item => {
    const fullPath = join(dirPath, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !EXCLUDED_DIRS.includes(item)) {
      processDirectory(fullPath);
    } else if (stat.isFile() && FILE_EXTENSIONS.some(ext => item.endsWith(ext))) {
      processFile(fullPath);
    }
  });
}

// Main execution
console.log('🔍 Scanning for verbose logging...');
const rootPath = join(__dirname, '..');
processDirectory(rootPath);
console.log('✅ Logging reduction complete!');