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

// v1.0 — single-axis spec anchors (simplification strength × passes).

test('SKILL.md is non-empty', () => {
  assert.ok(skillBody.length > 0, 'SKILL.md should not be empty');
  assert.ok(skillBody.trim().length > 0, 'SKILL.md should have real content');
});

test('SKILL.md contains v1.0 North Star (obviously easier than raw)', () => {
  assert.match(
    skillBody,
    /obviously easier to understand than raw Claude/i,
    'North Star — answer must be obviously easier than raw'
  );
});

test('SKILL.md defines all 4 stages with v1.0 prompt-equivalent definitions', () => {
  // adult — "이해하기 쉽게" × 1, lossless
  assert.match(skillBody, /이해하기 쉽게 설명해줘.*×.*1.*lossless/i,
    'adult definition (이해하기 쉽게 ×1 lossless) missing');
  // kid — "아주 쉽게" × 1
  assert.match(skillBody, /아주 쉽게 설명해줘.*×.*1.*\(DEFAULT\)/i,
    'kid definition (아주 쉽게 ×1 default) missing');
  // baby — "아주 쉽게" × 2 internal 2-pass
  assert.match(skillBody, /아주 쉽게 설명해줘.*×.*2.*internal 2-pass/i,
    'baby definition (아주 쉽게 ×2 internal 2-pass) missing');
  // auto — Claude picks per question
  assert.match(skillBody, /auto.*Claude picks per question/i,
    'auto definition (Claude picks) missing');
});

test('SKILL.md contains visual-aids-default-on rule with skip conditions', () => {
  assert.match(skillBody, /Visual aids default ON/i,
    'visual aids default ON heading missing');
  assert.match(skillBody, /Yes\/No answer/i, 'skip condition (yes/no) missing');
  assert.match(skillBody, /Single-line answer/i, 'skip condition (single-line) missing');
  assert.match(skillBody, /Pure code dump/i, 'skip condition (pure code) missing');
  assert.match(skillBody, /Precise number \/ threshold/i,
    'skip condition (precise number) missing');
});

test('SKILL.md preserves LEVEL-1 invariants (preservation + code quality)', () => {
  assert.match(skillBody, /Preservation \(LEVEL-1 INVARIANT/,
    'preservation LEVEL-1 heading missing');
  assert.match(skillBody, /Code quality \(LEVEL-1 INVARIANT/,
    'code quality LEVEL-1 heading missing');
});

test('SKILL.md preserves Plan mode integration with EVERY-iteration clause', () => {
  assert.match(skillBody, /## Plan mode integration/,
    'plan mode integration heading missing');
  assert.match(skillBody, /Applies on EVERY plan generation/,
    'plan-mode iteration clause missing');
  assert.ok(skillBody.includes('한 줄 요약'),
    'Korean summary heading literal missing');
});

test('rules/eli-activate.md is non-empty', () => {
  assert.ok(rulesBody.length > 0, 'rules/eli-activate.md should not be empty');
  assert.ok(rulesBody.trim().length > 0, 'rules/eli-activate.md should have real content');
});

// v1.0 Codex review fix — public-facing copy (commands + README + sub-skills
// help/stats) must NOT teach the removed v0.x framings. Catches stale docs.
test('public surface contains no removed v0.x framings (v1.0 Codex P1.2)', () => {
  const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
  const README = path.join(REPO_ROOT, 'README.md');
  const ELI_HELP_SKILL = path.join(REPO_ROOT, 'skills', 'eli-help', 'SKILL.md');
  const ELI_STATS_SKILL = path.join(REPO_ROOT, 'skills', 'eli-stats', 'SKILL.md');

  const surfaces = [
    path.join(COMMANDS_DIR, 'eli.toml'),
    path.join(COMMANDS_DIR, 'eli-help.toml'),
    path.join(COMMANDS_DIR, 'eli-stats.toml'),
    README,
    ELI_HELP_SKILL,
    ELI_STATS_SKILL,
  ];

  // Removed v0.x framings — must NOT appear on user-facing surface.
  const removedFramings = [
    /translation depth/i,
    /near-raw/i,
    /light translation/i,
    /deepest translation/i,
    /ELI 3\b/i,
    /ELI 10\b/i,
    /ELI 25\b/i,
    /알잘딱깔센/,
  ];

  for (const surfacePath of surfaces) {
    const body = fs.readFileSync(surfacePath, 'utf8');
    const fileName = path.basename(surfacePath);
    for (const re of removedFramings) {
      assert.doesNotMatch(body, re,
        fileName + ' must not contain removed v0.x framing: ' + re);
    }
  }
});

test('rules/eli-activate.md mirrors v1.0 spec (4 stages + LEVEL-1 + plan iteration)', () => {
  // 4 stages
  assert.match(rulesBody, /이해하기 쉽게 설명.*×1.*lossless/i, 'rules adult missing');
  assert.match(rulesBody, /아주 쉽게 설명.*×1/i, 'rules kid missing');
  assert.match(rulesBody, /아주 쉽게 설명.*×2.*internal 2-pass/i, 'rules baby missing');
  assert.match(rulesBody, /picking per question/i, 'rules auto missing');
  // Visual aids default ON
  assert.match(rulesBody, /Visual aids default ON/i, 'rules visual-aids missing');
  // LEVEL-1 invariants
  assert.match(rulesBody, /Preservation \(LEVEL-1/i, 'rules preservation missing');
  assert.match(rulesBody, /Code quality.*LEVEL-1 INVARIANT/i, 'rules code quality missing');
  // Plan mode iteration
  assert.match(rulesBody, /Applies on EVERY plan generation/i,
    'rules plan-mode iteration missing');
});
