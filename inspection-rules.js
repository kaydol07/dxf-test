/* Pure quality rules shared by the inspection UI and automated tests. */
(function attachInspectionRules(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DXF_INSPECTION_RULES = api;
})(typeof window === 'undefined' ? globalThis : window, function createInspectionRules() {
  function childCompletionStatus(parentCompletion) {
    return parentCompletion === 'DONE' ? 'DONE' : 'NOT_DONE';
  }
  function parentQualityStatus(completion, childQualities, currentQuality = 'NOT_CHECKED') {
    if (completion === 'PARTIAL') return 'NON_COMPLIANT';
    if (completion !== 'DONE') return 'NOT_CHECKED';
    const values = Array.isArray(childQualities) ? childQualities : [];
    if (values.includes('NON_COMPLIANT')) return 'NON_COMPLIANT';
    if (values.length && values.every(value => value === 'COMPLIANT')) return 'COMPLIANT';
    return currentQuality;
  }
  return { childCompletionStatus, parentQualityStatus };
});
