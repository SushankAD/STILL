import { DEFAULT_SOCIAL_WINDOW, findTemplate, habitTemplates, normalizedTitle, POLICY_VERSION } from './habit-policy.ts'
import type { HabitPolicy, SocialWindow, TemplateKey } from './habit-policy.ts'

type EvidencePolicy = Pick<HabitPolicy, 'userInstruction' | 'verificationMode' | 'acceptableEvidence' |
  'insufficientEvidence' | 'rejectionCriteria' | 'completionCriteria' | 'verificationLimitations'> &
  Partial<Pick<HabitPolicy, 'measurableTarget' | 'privacyGuidance' | 'dateBasis'>>

const predefined: Record<TemplateKey, EvidencePolicy> = {
  water: {
    userInstruction: 'Take a photo of yourself holding or drinking from a water bottle or a glass of water.',
    verificationMode: 'PHOTO',
    acceptableEvidence: ['Drinking from a water bottle, glass, cup, or tumbler', 'Holding a water bottle or a glass of water'],
    insufficientEvidence: ['A container sitting alone without evidence someone is holding or drinking from it'],
    rejectionCriteria: ['Unrelated scene or clearly non-water beverage'],
    completionCriteria: ['A person is drinking from a plausible water container or holding a water bottle or glass of water. Drinking from an opaque cup is acceptable when there is no evidence of a non-water drink. Hands suffice for holding.'],
    verificationLimitations: ['A photo cannot establish the amount of water consumed.'],
  },
  movement: {
    userInstruction: 'Take a photo of yourself walking, running outdoors, exercising on a treadmill, or doing another physical activity.',
    verificationMode: 'HYBRID',
    acceptableEvidence: ['Walking or running on a road, sidewalk, or trail with visible activity cues', 'Treadmill, cycling, strength training, gym workout, yoga, or stretching in progress', 'A dated fitness activity record'],
    insufficientEvidence: ['Scenery, exercise equipment, shoes, or clothing without evidence of activity'],
    rejectionCriteria: ['Unrelated images or a fitness goal without an activity record'],
    completionCriteria: ['Show credible participation in physical activity or a recorded completed exercise activity.'],
    verificationLimitations: ['A photo cannot establish workout duration or intensity.', 'Take a photo only when safe.'],
    privacyGuidance: 'Keep your face and location details out of the frame. Take a photo only when safe.',
  },
  reading: {
    userInstruction: 'Take a photo of yourself reading or show your open book with your reading progress visible.',
    verificationMode: 'HYBRID',
    acceptableEvidence: ['Reading a physical book, ebook, or e-reader', 'Visible session progress or before-and-after book locations in a single image'],
    insufficientEvidence: ['An open book or e-reader without a session page count or before-and-after progress'],
    rejectionCriteria: ['Unrelated images or a clearly unmet reading target'],
    completionCriteria: ['Reading evidence is relevant. Accept completion only when evidence establishes at least 20 pages of reading for the session. A single page number, total progress, or a percentage alone is insufficient.'],
    measurableTarget: { value: 20, unit: 'pages' },
    verificationLimitations: ['A photo of reading establishes activity, while a record or progress comparison is needed for the page target.'],
  },
  journal: {
    userInstruction: 'Take a photo of yourself writing in your journal or show your completed journal page. You may cover private writing.',
    verificationMode: 'HYBRID',
    acceptableEvidence: ['Writing in a journal with a page visibly in progress', 'A completed handwritten or digital journal page, including redacted writing'],
    insufficientEvidence: ['A blank notebook, unopened journal, or empty editor'],
    rejectionCriteria: ['Unrelated material or a blank document presented as a completed entry'],
    completionCriteria: ['A completed journal page is visible, even with redactions. Writing in progress is relevant but partial when a completed page cannot be established. Assess the page or entry layout without reading any personal text.'],
    measurableTarget: { value: 1, unit: 'journal page' },
    privacyGuidance: 'Cover or redact personal writing. The page layout and visible evidence of writing are enough.',
    verificationLimitations: ['Journal content does not need to be readable.'],
  },
  sleep: {
    userInstruction: 'Upload a sleep-tracking report showing your sleep start time before 11 PM.',
    verificationMode: 'HYBRID',
    acceptableEvidence: ['A sleep-tracking report with a recorded sleep start and the date that sleep began', 'Explicit self-report when a tracker is unavailable'],
    insufficientEvidence: ['Bed, bedroom, clock, bedtime schedule, time in bed, or person lying down'],
    rejectionCriteria: ['Unrelated images, mismatched dates or time zones, or recorded sleep start at or after 11 PM'],
    completionCriteria: ['The report visibly establishes actual recorded sleep start on the requested local date before 23:00. Use the sleep-onset date, which can differ from the wake-up date in overnight reports.'],
    measurableTarget: { value: 1380, unit: 'minutes after local midnight, exclusive upper bound' },
    dateBasis: 'LAST_CLOSED_DAY',
    verificationLimitations: ['A sleep tracker estimates when you fell asleep.', 'Manual completion is labeled self-reported.'],
    privacyGuidance: 'Crop out health metrics and account details. Keep the sleep start and date visible.',
  },
  social: {
    userInstruction: "Upload today's Screen Time or Digital Wellbeing report showing your social media usage.",
    verificationMode: 'SCREENSHOT',
    acceptableEvidence: ['A dated Screen Time or Digital Wellbeing report with visible usage totals for the complete evaluation window'],
    insufficientEvidence: ['A photo of a phone, an app limit setting, weekly averages, an incomplete report, or a list omitting relevant social apps or browser usage'],
    rejectionCriteria: ['Usage above the configured limit, mismatched date, or an unrelated report'],
    completionCriteria: ['Show the social media category or a complete itemized view covering social media and the entire configured window. Use recorded usage, not configured limits. Missing apps or obscured totals cannot be interpreted as zero.'],
    verificationLimitations: ['A screen-time report covers the devices and usage included in that report.'],
    privacyGuidance: 'Crop out account details and unrelated usage. Keep the date, reporting window, and social usage total visible.',
  },
}

export function predefinedPolicy(key: TemplateKey, title: string, social = DEFAULT_SOCIAL_WINDOW): HabitPolicy {
  const policy: HabitPolicy = {
    habitTitle: title,
    habitCategory: habitTemplates.find((template) => template.templateKey === key)!.area,
    measurableTarget: { value: null, unit: null },
    privacyGuidance: 'Your face does not need to be visible. Keep unrelated personal details out of the image.',
    policyVersion: POLICY_VERSION,
    safetyStatus: 'ALLOWED',
    dateBasis: 'CURRENT_DAY',
    ...predefined[key],
  }
  if (key === 'social') {
    const end = social.endHour === 24 ? 'the next midnight' : `${String(social.endHour).padStart(2, '0')}:00`
    policy.measurableTarget = { value: social.limitMinutes, unit: 'minutes of social media use, inclusive upper bound' }
    policy.completionCriteria = [...policy.completionCriteria, `The local window is midnight to ${end}, with no more than ${social.limitMinutes} minutes of social media use.`]
  }
  return policy
}

export async function resolveHabitPolicy(
  title: string,
  socialWindow: SocialWindow,
  generateCustom: (title: string) => Promise<HabitPolicy>,
  previous?: { title: string; policy: HabitPolicy | null; socialWindow: SocialWindow },
) {
  const template = findTemplate(title)
  const sameTarget = template !== 'social' || (
    previous?.socialWindow.limitMinutes === socialWindow.limitMinutes && previous.socialWindow.endHour === socialWindow.endHour
  )
  if (previous?.policy && sameTarget && normalizedTitle(previous.title) === normalizedTitle(title)) {
    return { policy: { ...previous.policy, habitTitle: title }, template, changed: false }
  }
  const policy = template ? predefinedPolicy(template, title, socialWindow) : await generateCustom(title)
  return { policy, template, changed: true }
}

