// Copyright 2025 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

const uuid = require('uuid');
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
    info.configured_rules = styleRule.configuredRules || [];
    info.custom_instructions = styleRule.customInstructions || [];
  }

  return info;
}

function isValidStyleId(styleId) {
  return uuid.validate(styleId);
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
  removeStyleRule,
  getDefaultStyleRule,
  DEFAULT_STYLE_RULE_ID,
};
