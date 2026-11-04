// Builds the codes catalogue (AuraTrack7-Shared/packages/model/src/codes/catalogue.generated.ts) and the label files
// (AuraTrack7-Shared/packages/i18n/src/labels/<lang>.json, review.json) from the 6.1 constants and locale files.
// Run once when the catalogue changes: node AuraTrack7-Shared/scripts/build-catalogue.mjs [path to AuraTrack6]
// Labels are ported from 6.1 only where 6.1 has them; everything else is listed in review.json and falls back to English.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const v6 = process.argv[2] ?? '/home/user01/Projects/AuraTrack6';
const C = await import(pathToFileURL(`${v6}/src/data/constants.js`).href);
const POST = readFileSync(`${v6}/src/utils/postIctal.js`, 'utf8');
const LANGS = ['en', 'nb', 'nn', 'da', 'sv', 'fi', 'de', 'fr', 'es'];
const locales = Object.fromEntries(
  LANGS.map((l) => [l, JSON.parse(readFileSync(`${v6}/src/locales/${l}.json`, 'utf8'))]),
);
const get = (lang, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), locales[lang]);

const slug = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const labels = Object.fromEntries(LANGS.map((l) => [l, {}])); // lang -> code -> label
const needsReview = new Map(); // code -> reason
const seen = new Set();
const claim = (code) => {
  if (seen.has(code)) throw new Error(`Duplicate code ${code}`);
  seen.add(code);
  return code;
};
// A label ported from a 6.1 locale key for every language that has it
const port = (code, key) => {
  for (const l of LANGS) {
    const v = get(l, key);
    if (typeof v === 'string' && v) labels[l][code] = v;
  }
};
const englishOnly = (code, text, reason = '6.1 has no translation') => {
  labels.en[code] = text;
  needsReview.set(code, reason);
};

// ---- seizure types
const TYPE_ILAE = {
  'Tonic-Clonic': { onset: 'generalized', awareness: null, motor: 'motor', feature: 'ilae.feature.tonic_clonic' },
  'Focal Aware': { onset: 'focal', awareness: 'aware', motor: null, feature: null },
  'Focal Impaired': { onset: 'focal', awareness: 'impaired', motor: null, feature: null },
  Absence: { onset: 'generalized', awareness: null, motor: 'non_motor', feature: 'ilae.feature.absence_typical' },
  'Aura Only': { onset: 'focal', awareness: 'aware', motor: 'non_motor', feature: null },
};
const seizureTypes = C.SEIZURE_TYPES.map((legacy) => {
  const key = slug(legacy);
  const code = claim(`seizure_type.${key}`);
  port(code, `seizure_types.${key}`);
  return { code, legacy, suggestedIlae: TYPE_ILAE[legacy] };
});

// ---- ILAE 2017 parts (new in v7: English only)
const ILAE_FEATURES = {
  motor: ['tonic', 'clonic', 'tonic_clonic', 'myoclonic', 'atonic', 'automatisms', 'epileptic_spasms', 'hyperkinetic'],
  non_motor: [
    'autonomic',
    'behavior_arrest',
    'cognitive',
    'emotional',
    'sensory',
    'absence_typical',
    'absence_atypical',
    'absence_myoclonic',
    'eyelid_myoclonia',
  ],
};
const text = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const ilaeFeatures = [];
for (const [group, list] of Object.entries(ILAE_FEATURES)) {
  for (const k of list) {
    const code = claim(`ilae.feature.${k}`);
    englishOnly(code, text(k).replace('Behavior arrest', 'Behaviour arrest'), 'new in v7');
    ilaeFeatures.push({ code, group });
  }
}
const ILAE_PARTS = {
  'ilae.onset.focal': 'Focal onset',
  'ilae.onset.generalized': 'Generalized onset',
  'ilae.onset.unknown': 'Unknown onset',
  'ilae.awareness.aware': 'Aware',
  'ilae.awareness.impaired': 'Impaired awareness',
  'ilae.awareness.unknown': 'Awareness unknown',
  'ilae.motor.motor': 'Motor',
  'ilae.motor.non_motor': 'Non-motor',
  'ilae.spread_to_both_sides': 'Spread to both sides',
};
for (const [code, label] of Object.entries(ILAE_PARTS)) englishOnly(claim(code), label, 'new in v7');

// ---- symptoms (the 6.1 symptom wizard, as codes)
const symptoms = [];
const symptomGroups = [];
for (const [category, groups] of Object.entries(C.SYMPTOM_WIZARD)) {
  const categoryCode = claim(`symptom_category.${slug(category)}`);
  englishOnly(categoryCode, category);
  for (const [group, def] of Object.entries(groups)) {
    const groupCode = claim(`symptom_group.${slug(category)}.${slug(group)}`);
    englishOnly(groupCode, group);
    symptomGroups.push({
      code: groupCode,
      category: categoryCode,
      legacy: group,
      legacyCategory: category,
      skipRegion: !!def.skipRegion,
    });
    for (const o of def.options) {
      const code = claim(`symptom.${slug(group)}.${slug(o.label)}`);
      englishOnly(code, o.label);
      symptoms.push({
        code,
        group: groupCode,
        legacyGroup: group,
        legacy: o.label,
        medicalTerm: o.med,
        forceRegion: o.forceRegion ?? null,
        forceSubRegion: o.forceSubRegion ?? null,
      });
    }
  }
}

// ---- body areas (region > sub-region (side) > close-up part)
const bodyRegions = [];
for (const [region, subs] of Object.entries(C.REGION_WIZARD)) {
  const rc = claim(`body.${slug(region)}`);
  englishOnly(rc, region);
  const subRegions = [];
  for (const [sub, parts] of Object.entries(subs)) {
    const sc = claim(`${rc}.${slug(sub)}`);
    englishOnly(sc, sub);
    const partList = parts.map((p) => {
      const pc = claim(`${sc}.${slug(p)}`);
      englishOnly(pc, p);
      return { code: pc, legacy: p };
    });
    subRegions.push({ code: sc, legacy: sub, parts: partList });
  }
  bodyRegions.push({ code: rc, legacy: region, subRegions });
}

// ---- triggers
const triggers = C.TRIGGER_DEFINITIONS.map((d) => {
  const key = d.labelKey.split('.')[1];
  const code = claim(`trigger.${key}`);
  port(code, d.labelKey);
  return { code, legacy: d.value, factor: d.factorId ? `factor.${slug(d.factorId.replace(/([A-Z])/g, '_$1'))}` : null };
});

// ---- after-seizure findings (6.1 post-ictal groups)
const groupBlock = /POST_ICTAL_GROUPS = \[([\s\S]*?)\n\];/.exec(POST)[1];
const findingGroups = [...groupBlock.matchAll(/\{ key: '(\w+)'(, open: true)?, findings: \[([^\]]*)\] \}/g)].map(
  (m) => ({
    key: m[1],
    open: !!m[2],
    findings: [...m[3].matchAll(/'(\w+)'/g)].map((x) => x[1]),
  }),
);
const locationFindings = new Set(
  [.../LOCATION_FINDINGS = new Set\(\[([^\]]*)\]/.exec(POST)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]),
);
const findings = [];
const findingGroupCodes = [];
for (const g of findingGroups) {
  const gc = claim(`after_group.${g.key}`);
  port(gc, `post_ictal.group.${g.key}`);
  findingGroupCodes.push({ code: gc, open: g.open });
  for (const k of g.findings) {
    const code = claim(`after.${k}`);
    port(code, `post_ictal.finding.${k}`);
    findings.push({ code, group: gc, location: locationFindings.has(k) });
  }
}
{
  const gc = claim('after_group.other');
  port(gc, 'post_ictal.group.other');
  findingGroupCodes.push({ code: gc, open: false });
  const code = claim('after.custom');
  port(code, 'post_ictal.group.other');
  findings.push({ code, group: gc, location: false });
}

// ---- moods and wellbeing factors
const moods = C.WELLBEING_MOOD_OPTIONS.map((m) => {
  const key = m.labelKey.split('.')[2].replace(/_label$/, '');
  const code = claim(`mood.${key}`);
  port(code, m.labelKey);
  return { code, legacy: m.label };
});
const factors = C.DEFAULT_WELLBEING_FACTORS.map((f) => {
  const key = f.labelKey.split('.')[2].replace(/_label$/, '');
  const code = claim(`factor.${key}`);
  port(code, f.labelKey);
  return { code, legacyId: f.id, type: f.type, unit: f.unit };
});

// ---- EEG activities and medication forms
const activities = C.EEG_ACTIVITY_OPTIONS.map((legacy) => {
  const code = claim(`activity.${slug(legacy)}`);
  englishOnly(code, legacy);
  return { code, legacy };
});
const forms = C.MEDICATION_FORMS.map((k) => {
  const code = claim(`form.${k}`);
  port(code, `medication_forms.${k}`);
  return { code, legacy: k };
});

// ---- write
const j = (v) => JSON.stringify(v, null, 2);
writeFileSync(
  'AuraTrack7-Shared/packages/model/src/codes/catalogue.generated.ts',
  `// GENERATED by AuraTrack7-Shared/scripts/build-catalogue.mjs from the 6.1 constants. Do not edit by hand; change the script and run it again.
// \`legacy\` is the English text 6.1 stored; the importer uses it to map old records to codes.

export const CATALOGUE_VERSION = 1;

export const SEIZURE_TYPES = ${j(seizureTypes)} as const;
export const ILAE_FEATURES = ${j(ilaeFeatures)} as const;
export const ILAE_PARTS = ${j(Object.keys(ILAE_PARTS))} as const;
export const SYMPTOM_GROUPS = ${j(symptomGroups)} as const;
export const SYMPTOMS = ${j(symptoms)} as const;
export const BODY_REGIONS = ${j(bodyRegions)} as const;
export const TRIGGERS = ${j(triggers)} as const;
export const FINDING_GROUPS = ${j(findingGroupCodes)} as const;
export const FINDINGS = ${j(findings)} as const;
export const MOODS = ${j(moods)} as const;
export const WELLBEING_FACTORS = ${j(factors)} as const;
export const EEG_ACTIVITIES = ${j(activities)} as const;
export const MEDICATION_FORMS = ${j(forms)} as const;
`,
);
mkdirSync('AuraTrack7-Shared/packages/i18n/src/labels', { recursive: true });
const review = {};
for (const l of LANGS) {
  const sorted = Object.fromEntries(Object.entries(labels[l]).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(`AuraTrack7-Shared/packages/i18n/src/labels/${l}.json`, `${j(sorted)}\n`);
  if (l !== 'en')
    review[l] = Object.keys(labels.en)
      .filter((c) => !(c in labels[l]))
      .sort();
}
// Codes whose English label is new in v7 (no 6.1 source) are listed apart from 6.1 gaps
review.newInV7 = [...needsReview]
  .filter(([, why]) => why === 'new in v7')
  .map(([c]) => c)
  .sort();
writeFileSync('AuraTrack7-Shared/packages/i18n/src/labels/review.json', `${j(review)}\n`);
console.log({
  codes: seen.size,
  symptoms: symptoms.length,
  activities: activities.length,
  review: Object.fromEntries(LANGS.slice(1).map((l) => [l, review[l].length])),
});
