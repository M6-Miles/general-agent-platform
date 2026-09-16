const {spawn} = require('node:child_process');

// Invoke Playwright through the current Node runtime so Windows does not need
// to spawn the shell wrapper (`npx.cmd`), which can fail with EINVAL.
const cli = require.resolve('@playwright/test/cli');
const child = spawn(process.execPath, [cli, 'test'], {
  stdio: 'inherit',
  env: {...process.env, PLAYWRIGHT_MODE: 'reuse'},
});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
