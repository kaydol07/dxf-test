const assert = require('node:assert/strict');
const { childCompletionStatus, parentQualityStatus } = require('../inspection-rules.js');

assert.equal(childCompletionStatus('NOT_DONE'), 'NOT_DONE');
assert.equal(childCompletionStatus('DONE'), 'DONE');
assert.equal(parentQualityStatus('NOT_DONE', ['NON_COMPLIANT']), 'NOT_CHECKED');
assert.equal(parentQualityStatus('PARTIAL', []), 'NON_COMPLIANT');
assert.equal(parentQualityStatus('DONE', ['COMPLIANT', 'NON_COMPLIANT']), 'NON_COMPLIANT');
assert.equal(parentQualityStatus('DONE', ['COMPLIANT', 'COMPLIANT']), 'COMPLIANT');
assert.equal(parentQualityStatus('DONE', ['NOT_CHECKED'], 'NOT_CHECKED'), 'NOT_CHECKED');

console.log('inspection quality rules: ok');
