'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { REPO_ROOT } = require('./helpers/isolated-env');

const SKILL_MD = path.join(REPO_ROOT, 'skills', 'eli', 'SKILL.md');
const RULES_MD = path.join(REPO_ROOT, 'rules', 'eli-activate.md');

const skillBody = fs.readFileSync(SKILL_MD, 'utf8');
const rulesBody = fs.readFileSync(RULES_MD, 'utf8');

test('SKILL.md preserves code-quality LEVEL-1 INVARIANT anchor', () => {
  assert.match(skillBody, /Code quality is stage-independent.*LEVEL-1 INVARIANT — NEVER VIOLATE/);
});

test('SKILL.md preserves Plan mode integration heading', () => {
  assert.match(skillBody, /## Plan mode integration/);
});

test('SKILL.md contains Korean "알잘딱깔센" identifier', () => {
  assert.ok(skillBody.includes('알잘딱깔센'));
});

test('SKILL.md references the ✨ auto stage', () => {
  assert.ok(skillBody.includes('✨'), 'sparkles emoji anchor');
  assert.ok(skillBody.includes('auto'), 'auto stage name anchor');
});

test('SKILL.md preserves Preservation LEVEL-1 heading', () => {
  assert.match(skillBody, /## Preservation \(LEVEL-1 rule/);
});

test('SKILL.md preserves Structure frame/TL;DR heading', () => {
  assert.match(skillBody, /## Structure — Frame at top, TL;DR at bottom/);
});

test('rules/eli-activate.md is non-empty', () => {
  assert.ok(rulesBody.length > 0, 'rules/eli-activate.md should not be empty');
  assert.ok(rulesBody.trim().length > 0, 'rules/eli-activate.md should have real content');
});

test('rules/eli-activate.md contains Code quality + Plan mode + 알잘딱깔센 anchors', () => {
  assert.ok(rulesBody.includes('Code quality'), 'Code quality anchor present');
  assert.ok(rulesBody.includes('Plan mode'), 'Plan mode anchor present');
  assert.ok(rulesBody.includes('알잘딱깔센'), 'Korean 4-criteria anchor present');
});

test('SKILL.md contains v0.9.1 calibration anchors (baby verification + context-scaling + plan iteration)', () => {
  // Fix 1A — baby verification rule.
  assert.ok(
    skillBody.includes('Verification questions'),
    'Fix 1A: baby section must contain "Verification questions" literal'
  );
  // Fix 1B — anti context-scaling rule.
  assert.match(
    skillBody,
    /Length is shaped by the TOPIC, not by preceding context/,
    'Fix 1B: must contain anti-context-scaling rule'
  );
  // Fix 3A — plan-mode iteration clause.
  assert.match(
    skillBody,
    /Applies on EVERY plan generation/,
    'Fix 3A: plan mode section must strengthen iteration wording'
  );
});

test('rules/eli-activate.md contains v0.9.1 calibration anchors (baby verification + plan iteration)', () => {
  // Fix 1F — baby verification rule (v2 agents consistency).
  assert.ok(
    rulesBody.includes('Verification questions'),
    'Fix 1F: baby line must contain "Verification questions" literal'
  );
  // Fix 3D — plan-mode iteration clause.
  assert.match(
    rulesBody,
    /EVERY plan generation|iterations included/,
    'Fix 3D: plan section must include iteration clause'
  );
});

// v0.9.2 — per-stage anti-drift reinforcement anchors.
test('SKILL.md contains v0.9.2 calibration anchor (translation depth fade example)', () => {
  assert.match(
    skillBody,
    /translation depth fade|Analogy is decoration; translation is the core baby work/,
    'v0.9.2: SKILL.md Calibration must include translation-depth-fade example'
  );
});

test('rules/eli-activate.md contains v0.9.2 per-stage reinforcement anchors (4 stages)', () => {
  assert.match(
    rulesBody,
    /Translation > analogy/,
    'v0.9.2 Layer 4 baby: rules baby must reinforce translation depth'
  );
  assert.match(
    rulesBody,
    /path-equality|Path-flag is mandatory/,
    'v0.9.2 Layer 4 kid: rules kid must reinforce path flag'
  );
  assert.match(
    rulesBody,
    /Lossless: NEVER add sections raw didn't include/,
    'v0.9.2 Layer 4 adult: rules adult must reinforce lossless'
  );
  assert.match(
    rulesBody,
    /Don't default-kid|default-kid habit/,
    'v0.9.2 Layer 4 auto: rules auto must reinforce per-question pick'
  );
});
