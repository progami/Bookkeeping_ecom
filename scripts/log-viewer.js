#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const logsDir = path.join(__dirname, '..', 'logs');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'view';

function getLatestLogFile() {
  try {
    const files = fs.readdirSync(logsDir)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .map(f => ({
        name: f,
        path: path.join(logsDir, f),
        mtime: fs.statSync(path.join(logsDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    return files[0]?.path;
  } catch (err) {
    console.error('Error reading logs directory:', err.message);
    return null;
  }
}

function formatLogEntry(entry) {
  try {
    const data = JSON.parse(entry);
    const { timestamp, level, message, ...meta } = data;
    
    let color = colors.reset;
    switch (level) {
      case 'error': color = colors.red; break;
      case 'warn': color = colors.yellow; break;
      case 'info': color = colors.green; break;
      case 'http': color = colors.cyan; break;
      case 'debug': color = colors.blue; break;
    }
    
    let output = `${colors.bright}${timestamp}${colors.reset} `;
    output += `${color}[${level.toUpperCase()}]${colors.reset} `;
    output += message;
    
    if (meta.requestId) {
      output += ` ${colors.magenta}[${meta.requestId}]${colors.reset}`;
    }
    
    // Add important metadata
    if (meta.duration) {
      output += ` ${colors.blue}(${meta.duration}ms)${colors.reset}`;
    }
    
    if (meta.statusCode) {
      const statusColor = meta.statusCode >= 400 ? colors.red : colors.green;
      output += ` ${statusColor}${meta.statusCode}${colors.reset}`;
    }
    
    if (meta.error) {
      output += '\n' + colors.red + '  Error: ' + (meta.error.message || meta.error) + colors.reset;
      if (meta.error.stack && args.includes('--stack')) {
        output += '\n' + colors.red + meta.error.stack.split('\n').map(l => '    ' + l).join('\n') + colors.reset;
      }
    }
    
    return output;
  } catch (e) {
    // If not JSON, return as is
    return entry;
  }
}

function viewLogs(logFile, options = {}) {
  if (!logFile) {
    console.error('No log files found in', logsDir);
    return;
  }
  
  console.log(`${colors.bright}Viewing: ${path.basename(logFile)}${colors.reset}\n`);
  
  const fileContent = fs.readFileSync(logFile, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  // Apply filters
  let filtered = lines;
  
  if (options.level) {
    filtered = filtered.filter(line => {
      try {
        const data = JSON.parse(line);
        return data.level === options.level;
      } catch (e) {
        return true;
      }
    });
  }
  
  if (options.search) {
    filtered = filtered.filter(line => 
      line.toLowerCase().includes(options.search.toLowerCase())
    );
  }
  
  if (options.last) {
    filtered = filtered.slice(-options.last);
  }
  
  // Display logs
  filtered.forEach(line => {
    console.log(formatLogEntry(line));
  });
  
  console.log(`\n${colors.bright}Total entries: ${filtered.length}${colors.reset}`);
}

function tailLogs(logFile) {
  if (!logFile) {
    console.error('No log files found in', logsDir);
    return;
  }
  
  console.log(`${colors.bright}Tailing: ${path.basename(logFile)}${colors.reset}`);
  console.log('Press Ctrl+C to stop\n');
  
  const tail = spawn('tail', ['-f', logFile]);
  
  tail.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(formatLogEntry(line));
    });
  });
  
  tail.stderr.on('data', (data) => {
    console.error(`Error: ${data}`);
  });
  
  process.on('SIGINT', () => {
    tail.kill();
    process.exit(0);
  });
}

function listLogs() {
  try {
    const files = fs.readdirSync(logsDir)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const stats = fs.statSync(path.join(logsDir, f));
        return {
          name: f,
          size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
          modified: stats.mtime.toLocaleString(),
        };
      })
      .sort((a, b) => b.modified.localeCompare(a.modified));
    
    console.log(`${colors.bright}Log files in ${logsDir}:${colors.reset}\n`);
    
    files.forEach(file => {
      console.log(`${colors.cyan}${file.name.padEnd(40)}${colors.reset} ${file.size.padStart(10)} ${colors.blue}${file.modified}${colors.reset}`);
    });
    
    console.log(`\n${colors.bright}Total: ${files.length} files${colors.reset}`);
  } catch (err) {
    console.error('Error listing logs:', err.message);
  }
}

function showHelp() {
  console.log(`
${colors.bright}Log Viewer Tool${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node scripts/log-viewer.js [command] [options]

${colors.cyan}Commands:${colors.reset}
  view [file]     View log file (default: latest session log)
  tail [file]     Tail log file in real-time
  list            List all log files
  help            Show this help

${colors.cyan}Options:${colors.reset}
  --level <level>     Filter by log level (error, warn, info, http, debug)
  --search <term>     Search for specific term
  --last <n>          Show last n entries
  --stack             Show full stack traces for errors
  --file <name>       Specify log file name

${colors.cyan}Examples:${colors.reset}
  node scripts/log-viewer.js view --level error
  node scripts/log-viewer.js view --search "GET /api" --last 50
  node scripts/log-viewer.js tail --file error-2024-01-15.log
  node scripts/log-viewer.js view combined-2024-01-15.log --level error --stack
`);
}

// Main execution
switch (command) {
  case 'view': {
    const fileName = args.find((arg, i) => args[i - 1] === '--file');
    const specificFile = args[1] && !args[1].startsWith('--') ? args[1] : null;
    const logFile = fileName 
      ? path.join(logsDir, fileName.endsWith('.log') ? fileName : fileName + '.log')
      : specificFile
      ? path.join(logsDir, specificFile.endsWith('.log') ? specificFile : specificFile + '.log')
      : getLatestLogFile();
    
    const options = {
      level: args.find((arg, i) => args[i - 1] === '--level'),
      search: args.find((arg, i) => args[i - 1] === '--search'),
      last: parseInt(args.find((arg, i) => args[i - 1] === '--last') || '0'),
    };
    
    viewLogs(logFile, options);
    break;
  }
  
  case 'tail': {
    const fileName = args.find((arg, i) => args[i - 1] === '--file');
    const specificFile = args[1] && !args[1].startsWith('--') ? args[1] : null;
    const logFile = fileName 
      ? path.join(logsDir, fileName.endsWith('.log') ? fileName : fileName + '.log')
      : specificFile
      ? path.join(logsDir, specificFile.endsWith('.log') ? specificFile : specificFile + '.log')
      : getLatestLogFile();
    
    tailLogs(logFile);
    break;
  }
  
  case 'list':
    listLogs();
    break;
    
  case 'help':
  default:
    showHelp();
    break;
}