// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const { randomUUID } = require('node:crypto');
const util = require('./util');

const styleRules = new Map();
const DEFAULT_STYLE_RULE_ID = 'dca2e053-8ae5-45e6-a0d2-881156e7f4e4';
util.scheduleCleanup(styleRules, (styleRule, styleId) => {
  console.log(`Removing style rule "${styleRule.name}" (${styleId})`);
});

// Temporary default style rule as a placeholder while we implement
// a create style rule endpoint
function getDefaultStyleRule() {
  return {
    styleId: DEFAULT_STYLE_RULE_ID,
    name: 'Default Style Rule',
    language: 'en',
    creationTime: new Date(0),
    updatedTime: new Date(0),
    version: 1,
    used: new Date(),
    authKey: null, // Available to all users
    configuredRules: { dates_and_times: { calendar_era: 'use_bce_and_ce' } },
    customInstructions: [],
  };
}

function extractStyleRuleInfo(styleRule, detailed = false) {
  const info = {
    style_id: styleRule.styleId,
    name: styleRule.name,
    language: styleRule.language.toLowerCase(),
    creation_time: styleRule.creationTime.toISOString(),
    updated_time: styleRule.updatedTime.toISOString(),
    version: styleRule.version,
  };

  if (detailed) {
    info.configured_rules = styleRule.configuredRules || {};
    info.custom_instructions = styleRule.customInstructions || [];
  }

  return info;
}

function isValidStyleId(styleId) {
  return util.isValidUuid(styleId);
}

function getStyleRule(styleId, authKey) {
  // Default style rule is always available for any authKey
  // Return a placeholder style rule that will be validated later with targetLang
  if (styleId === DEFAULT_STYLE_RULE_ID) {
    return getDefaultStyleRule();
  }
  const styleRule = styleRules.get(styleId);
  if (styleRule?.authKey === authKey) {
    styleRule.used = new Date();
    return styleRule;
  }
  throw new util.HttpError('not found', 404);
}

function getStyleRuleInfo(styleId, authKey, detailed = false) {
  return extractStyleRuleInfo(getStyleRule(styleId, authKey), detailed);
}

function getStyleRuleInfoList(authKey, page, pageSize, detailed) {
  const result = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const [, styleRule] of styleRules.entries()) {
    if (styleRule.authKey === authKey) {
      result.push(extractStyleRuleInfo(styleRule, detailed));
    }
  }
  const defaultStyleRule = getDefaultStyleRule();
  result.push(extractStyleRuleInfo(defaultStyleRule, detailed));

  // Apply pagination
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedResult = result.slice(startIndex, endIndex);

  return {
    style_rules: paginatedResult,
  };
}

function createStyleRule(name, language, authKey, configuredRules = {}, customInstructions = []) {
  // Validate custom instructions
  if (customInstructions.length > 200) {
    throw new util.HttpError('Maximum of 200 custom instructions allowed', 400);
  }

  // Validate each custom instruction
  const validatedInstructions = customInstructions.map((instruction) => {
    if (!instruction.prompt || instruction.prompt.length > 300) {
      throw new util.HttpError('Each custom instruction must have a prompt of at most 300 characters', 400);
    }
    return {
      id: randomUUID(),
      label: instruction.label || '',
      prompt: instruction.prompt,
      source_language: instruction.source_language || language,
    };
  });

  const styleId = randomUUID();
  const now = new Date();

  const styleRule = {
    styleId,
    name,
    language: language.toLowerCase(),
    creationTime: now,
    updatedTime: now,
    version: 1,
    used: now,
    authKey,
    configuredRules: configuredRules || {},
    customInstructions: validatedInstructions,
  };

  styleRules.set(styleId, styleRule);
  console.log(`Created style rule "${styleRule.name}" (${styleId})`);
  return extractStyleRuleInfo(styleRule, true);
}

function patchStyleRule(styleId, authKey, updates) {
  const styleRule = getStyleRule(styleId, authKey);

  if (updates.name !== undefined) {
    styleRule.name = updates.name;
  }

  styleRule.updatedTime = new Date();
  styleRule.version += 1;

  return extractStyleRuleInfo(styleRule, true);
}

function updateConfiguredRules(styleId, authKey, configuredRules) {
  const styleRule = getStyleRule(styleId, authKey);

  styleRule.configuredRules = configuredRules || {};

  styleRule.updatedTime = new Date();
  styleRule.version += 1;

  return extractStyleRuleInfo(styleRule, true);
}

function createCustomInstruction(styleId, authKey, label, prompt, sourceLanguage) {
  const styleRule = getStyleRule(styleId, authKey);

  if (styleRule.customInstructions.length >= 200) {
    throw new util.HttpError('Maximum of 200 custom instructions allowed', 400);
  }

  if (!prompt || prompt.length > 300) {
    throw new util.HttpError('Custom instruction prompt must be at most 300 characters', 400);
  }

  const instruction = {
    id: randomUUID(),
    label: label || '',
    prompt,
    source_language: sourceLanguage || styleRule.language,
  };

  styleRule.customInstructions.push(instruction);
  styleRule.updatedTime = new Date();
  styleRule.version += 1;

  return instruction;
}

function getCustomInstruction(styleId, instructionId, authKey) {
  const styleRule = getStyleRule(styleId, authKey);
  const instruction = styleRule.customInstructions.find((inst) => inst.id === instructionId);

  if (!instruction) {
    throw new util.HttpError('Custom instruction not found', 404);
  }

  return instruction;
}

function updateCustomInstruction(styleId, instructionId, authKey, label, prompt, sourceLanguage) {
  const styleRule = getStyleRule(styleId, authKey);
  const index = styleRule.customInstructions.findIndex((inst) => inst.id === instructionId);

  if (index === -1) {
    throw new util.HttpError('Custom instruction not found', 404);
  }

  if (!prompt || prompt.length > 300) {
    throw new util.HttpError('Custom instruction prompt must be at most 300 characters', 400);
  }

  styleRule.customInstructions[index] = {
    id: instructionId,
    label: label || '',
    prompt,
    source_language: sourceLanguage || styleRule.language,
  };

  styleRule.updatedTime = new Date();
  styleRule.version += 1;

  return styleRule.customInstructions[index];
}

function removeCustomInstruction(styleId, instructionId, authKey) {
  const styleRule = getStyleRule(styleId, authKey);
  const index = styleRule.customInstructions.findIndex((inst) => inst.id === instructionId);

  if (index === -1) {
    throw new util.HttpError('Custom instruction not found', 404);
  }

  console.log(`Removing custom instruction "${styleRule.customInstructions[index].label}" from style rule "${styleRule.name}" (${styleId})`);
  styleRule.customInstructions.splice(index, 1);
  styleRule.updatedTime = new Date();
  styleRule.version += 1;
  console.log('Done');
}

function removeStyleRule(styleId, authKey) {
  const styleRule = getStyleRule(styleId, authKey);
  console.log(`Removing style rule "${styleRule.name}" (${styleId})`);
  styleRules.delete(styleId);
  console.log('Done');
}

module.exports = {
  isValidStyleId,
  getStyleRule,
  getStyleRuleInfo,
  getStyleRuleInfoList,
  createStyleRule,
  patchStyleRule,
  updateConfiguredRules,
  removeStyleRule,
  createCustomInstruction,
  getCustomInstruction,
  updateCustomInstruction,
  removeCustomInstruction,
  getDefaultStyleRule,
  DEFAULT_STYLE_RULE_ID,
};
