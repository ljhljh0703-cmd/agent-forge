import { seedDebugThresholdDemo } from './evolution.js';

const repoRoot = process.cwd();
const runId = process.argv[2]?.trim();

if (!runId) {
  console.error('Usage: node orchestrator/dist/evolution-seed.js <verified-run-id>');
  process.exit(1);
}

seedDebugThresholdDemo(repoRoot, runId)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
