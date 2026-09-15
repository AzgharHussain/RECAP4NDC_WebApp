const LEVELS = ['division', 'range', 'round', 'beat'];

function normalizeArea(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return ['', '-', 'n/a', 'na', 'null', 'none', 'undefined', 'all'].includes(text)
    ? '' : text.replace(/[\s_-]+/g, '');
}

function getAccessScope(user, { ownRecords = false } = {}) {
  if (!user) return { denied: true, areas: {} };
  const roles = [user.role, user.designation, user.nameOfPost, user.NameOfPost, user.cadre, user.CadreName]
    .map(normalizeArea);
  const globalRole = roles.some(role => /^(admin|administrator|hoff|hof|pccf|apccf|ccf|cf|circle|circleofficer|circlelevelofficer)$/.test(role)
    || /^(principalchiefconservator|additionalprincipalchiefconservator|headofforestforce|chiefconservator)/.test(role));
  const areas = Object.fromEntries(LEVELS.filter(level => normalizeArea(user[level])).map(level => [level, user[level]]));
  if (globalRole) return { areas: {} };
  const guard = roles.some(role => /^(beatguard|forestguard|fg|guard)$/.test(role));
  const requiredLevel = guard ? 'beat'
    : roles.some(role => /^(rfo|rangeforest(?:officer)?|rangeofficer)$/.test(role)) ? 'range'
    : roles.some(role => /^(dcf|deputyconservator(?:offorests?)?|divisionalforestofficer|dfo)$/.test(role)) ? 'division'
    : roles.some(role => /^(roundofficer|forester|roundforester)$/.test(role)) ? 'round' : null;
  const userId = user.userId ?? user.user_id ?? user.id;
  if (ownRecords && guard) return { areas: {}, userId, denied: userId == null || userId === '' };
  if (requiredLevel && !areas[requiredLevel]) return { denied: true, areas: {} };
  if (!Object.keys(areas).length) {
    return { areas: {}, denied: !normalizeArea(user.circle) || !!requiredLevel };
  }
  if (requiredLevel) {
    const last = LEVELS.indexOf(requiredLevel);
    for (const level of LEVELS.slice(last + 1)) delete areas[level];
  }
  return { areas };
}

function normalizedSql(field) {
  return `LOWER(REGEXP_REPLACE(COALESCE(${field}::text, ''), '[[:space:]_-]+', '', 'g'))`;
}

function appendAccessConditions(conditions, values, user, options = {}) {
  const { alias = '', fields = {}, ownRecords = false } = options;
  const prefix = alias ? `${alias}.` : '';
  const scope = getAccessScope(user, { ownRecords });
  if (scope.denied) {
    conditions.push('FALSE');
    return;
  }
  if (scope.userId != null) {
    values.push(String(scope.userId));
    conditions.push(`${fields.user_id || `${prefix}user_id`}::text = $${values.length}`);
  }
  for (const [level, value] of Object.entries(scope.areas)) {
    if (fields[level] === null) {
      conditions.push('FALSE');
      continue;
    }
    values.push(normalizeArea(value));
    conditions.push(`${normalizedSql(fields[level] || `${prefix}"${level}"`)} = $${values.length}`);
  }
}

function accessSql(user, options = {}) {
  const conditions = [];
  const values = [];
  appendAccessConditions(conditions, values, user, options);
  const replacements = Object.fromEntries(values.map((value, index) => [`access${index + 1}`, value]));
  return {
    clause: (conditions.join(' AND ') || 'TRUE').replace(/\$(\d+)/g, ':access$1'),
    replacements,
  };
}

function canAccessRecord(user, record, options = {}) {
  const scope = getAccessScope(user, options);
  if (scope.denied || !record) return false;
  if (scope.userId != null && String(record.user_id) !== String(scope.userId)) return false;
  return Object.entries(scope.areas).every(([level, value]) =>
    normalizeArea(record[options.fields?.[level] || level]) === normalizeArea(value));
}

function formatPatrolCode(code) {
  return code == null ? code : String(code).replace(/^PAT[-_\s]*/i, '');
}

module.exports = { normalizeArea, normalizedSql, getAccessScope, appendAccessConditions, accessSql, canAccessRecord, formatPatrolCode };
