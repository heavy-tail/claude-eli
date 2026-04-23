'use strict';

// Layer 4 PBT — eli-mode-tracker.js robustness under arbitrary command
// sequences. For any permutation of length 1..20 drawn from the ELI
// command whitelist, the final flag state must be either absent or a
// string that trims + lowercases to a value in VALID_MODES. This pins
// the readFlag contract (null-on-anomaly) against any accidental write
// of a junk or out-of-whitelist value during a sequence.

const { test } = require('node:test');
const fc = require('fast-check');

const {
  makeIsolatedEnv,
  runTracker,
  readRawFlag,
} = require('../helpers/isolated-env');

const VALID_MODES = ['off', 'baby', 'kid', 'adult', 'auto'];

// Whitelist of commands + natural-language triggers the tracker recognizes.
// Covers: explicit stage sets, shifts, off/on toggles, raw bypass, a sub-skill
// that must not mutate the flag, and two natural-language deactivation/
// activation phrases.
const COMMAND_POOL = [
  '/eli baby',
  '/eli kid',
  '/eli adult',
  '/eli auto',
  '/eli off',
  '/eli on',
  '/eli raw',
  '/eli easier',
  '/eli harder',
  '/eli-glossary',
  'stop eli',
  'eli mode',
];

// 500 runs × up to 20 subprocess spawns per run = up to ~10k spawns. Give the
// Node test a generous 10 minute ceiling. Do not lower numRuns below 500 —
// shrinking floor is part of the guarantee this property makes.
test(
  'sequence fuzz: any whitelist command sequence leaves flag in VALID_MODES or absent',
  { timeout: 600000 },
  () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...COMMAND_POOL), { minLength: 1, maxLength: 20 }),
        (sequence) => {
          const envBundle = makeIsolatedEnv();
          try {
            for (const cmd of sequence) {
              runTracker(envBundle, cmd);
            }
            const raw = readRawFlag(envBundle.claudeDir);
            if (raw === null) {
              // Flag is absent — acceptable (e.g., /eli off, stop eli).
              return true;
            }
            const normalized = raw.trim().toLowerCase();
            return VALID_MODES.includes(normalized);
          } finally {
            envBundle.cleanup();
          }
        }
      ),
      { numRuns: 500 }
    );
  }
);
