const cp = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('--- RESTORING CODEBASE FROM GITHUB ---');

function runCmd(cmd) {
  try {
    console.log(`Executing: ${cmd}`);
    const out = cp.execSync(cmd, { encoding: 'utf8' });
    console.log(out);
    return out;
  } catch (err) {
    console.error(`Error executing ${cmd}:`, err.message);
    if (err.stdout) console.log('STDOUT:', err.stdout);
    if (err.stderr) console.error('STDERR:', err.stderr);
    return null;
  }
}

// 1. Clone into a temp folder
runCmd('rm -rf temp_clone');
const cloneSuccess = runCmd('git clone https://github.com/raghavdhoot/Venkatesh-Cotton-Management-app.git temp_clone');

if (cloneSuccess !== null) {
  console.log('Clone succeeded! Copying files to /app/applet...');
  
  // 2. Recursively copy files
  function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      fs.readdirSync(src).forEach((childItemName) => {
        copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
      });
    } else {
      // Don't overwrite package-lock.json if we don't need to, but actually we do want a pristine clone
      fs.copyFileSync(src, dest);
    }
  }

  // Copy files except .git folder (optional, actually keeping .git is great because we have version tracking!)
  // Let's copy everything including hidden files, but let's delete the temp_clone folder when done
  const items = fs.readdirSync('temp_clone');
  for (const item of items) {
    copyRecursiveSync(path.join('temp_clone', item), path.join('.', item));
  }
  
  console.log('Removing temp_clone folder...');
  runCmd('rm -rf temp_clone');
  
  console.log('\n--- RESTORE COMPLETE. NEW CWD CONTENTS: ---');
  console.log(fs.readdirSync('.'));
} else {
  console.error('Failed to clone repository.');
}
