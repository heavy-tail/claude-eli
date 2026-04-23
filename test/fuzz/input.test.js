'use strict';

// Layer 4 PBT — eli-mode-tracker.js "never throws" property under any
// stdin content. The hook wraps its whole end-of-stream handler in a
// try/catch that swallows every exception (see eli-mode-tracker.js
// lines 39-200). So regardless of whether stdin is valid JSON, invalid
// JSON, empty, a unicode blob, an integer literal, or a serialized
// array of arbitrary values, the process must exit cleanly (code 0,
// no spawn error, no crash signal).

const { test } = require('node:test');
const fc = require('fast-check');

const {
  makeIsolatedEnv,
  runTrackerRawStdin,
} = require('../helpers/isolated-env');

// Generator strategy (matches plan):
//   - Raw ASCII strings (maxLength 10000) — almost all fail JSON.parse and
//     exercise the catch path.
//   - Unicode strings — surrogate pairs / RTL / control chars etc. as raw
//     stdin, also mostly non-JSON.
//   - Empty stdin constant.
//   - Integers and arbitrary arrays JSON-stringified — these JSON.parse
//     successfully but produce data where `data.prompt` is undefined.
const rawStdinArb = fc.oneof(
  // Raw text that almost never parses as JSON — hits the catch arm.
  fc.string({ maxLength: 10000 }),
  fc.unicodeString(),
  fc.constant(''),
  // Typed values serialized to JSON — parse succeeds, `.prompt` is undefined,
  // subsequent `.trim()` on undefined is caught by the outer try/catch.
  fc.integer().map((n) => JSON.stringify(n)),
  fc.array(fc.anything()).map((a) => JSON.stringify(a))
);

// 300 runs × one subprocess spawn per run. Generous Node test timeout to
// survive slow CI or GC pauses; do not lower numRuns below 300.
test(
  'input fuzz: eli-mode-tracker.js exits cleanly for any stdin content',
  { timeout: 300000 },
  () => {
    fc.assert(
      fc.property(rawStdinArb, (rawStdin) => {
        const envBundle = makeIsolatedEnv();
        try {
          const result = runTrackerRawStdin(envBundle, rawStdin);
          // No spawn-level error (ENOENT, EACCES, timeout) and clean exit.
          if (result.error) return false;
          if (result.signal) return false;
          return result.code === 0;
        } finally {
          envBundle.cleanup();
        }
      }),
      { numRuns: 300 }
    );
  }
);
