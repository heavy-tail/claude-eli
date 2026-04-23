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
