// Node driver for the shared engine fidelity suite (the browser runs the same via /test.html).
import { runTests } from './js/engine/tests.mjs';
const { passed, failed, log } = await runTests();
for (const l of log) console.log(l);
process?.exit && (failed ? process.exit(1) : process.exit(0));
