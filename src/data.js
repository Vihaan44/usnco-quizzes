// Base path for all static assets
const BASE = '/usnco_results'

export function imgUrl(folder, filename) {
  if (!filename) return ''
  return `${BASE}/${folder}/${filename}`
}

export async function loadIndex() {
  const res = await fetch(`${BASE}/index.json`)
  return res.json()
}

export async function loadExamMeta(folder) {
  // derive prefix from folder name e.g. USNCO_2025_Local -> 2025_local
  const m = folder.match(/USNCO_(\d+)_(\w+)/)
  if (!m) throw new Error(`Bad folder: ${folder}`)
  const prefix = `${m[1]}_${m[2].toLowerCase()}`
  const res = await fetch(`${BASE}/${folder}/${prefix}_metadata.json`)
  if (!res.ok) throw new Error(`Failed to load ${folder}`)
  return res.json()
}

export async function loadAllQuestions() {
  const { exams } = await loadIndex()
  const all = []
  await Promise.all(
    exams.map(async ({ folder }) => {
      try {
        const meta = await loadExamMeta(folder)
        meta.questions.forEach(q => {
          all.push({ ...q, folder })
        })
      } catch (e) {
        console.warn('Could not load', folder, e)
      }
    })
  )
  return all
}

export const TOPICS = [
  { slug: 'stoichiometry',  label: 'Stoichiometry & Solutions',       range: [1,6],   icon: '⚗️' },
  { slug: 'descriptive',    label: 'Descriptive & Laboratory',        range: [7,12],  icon: '🧪' },
  { slug: 'states',         label: 'States of Matter',                range: [13,18], icon: '🌡️' },
  { slug: 'thermo',         label: 'Thermodynamics',                  range: [19,24], icon: '🔥' },
  { slug: 'kinetics',       label: 'Kinetics',                        range: [25,30], icon: '⚡' },
  { slug: 'equilibrium',    label: 'Equilibrium',                     range: [31,36], icon: '⚖️' },
  { slug: 'redox',          label: 'Oxidation-Reduction',             range: [37,42], icon: '🔋' },
  { slug: 'atomic',         label: 'Atomic Structure & Periodicity',  range: [43,48], icon: '⚛️' },
  { slug: 'bonding',        label: 'Bonding & Molecular Structure',   range: [49,54], icon: '🔗' },
  { slug: 'organic',        label: 'Organic & Biochemistry',          range: [55,60], icon: '🧬' },
]

export function topicBySlug(slug) {
  return TOPICS.find(t => t.slug === slug)
}

export function topicByLabel(label) {
  return TOPICS.find(t => t.label === label)
}

// localStorage stats helpers
const STATS_KEY = 'usnco_stats'

export function getStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY)) || {} }
  catch { return {} }
}

export function recordAnswer(questionKey, correct) {
  const stats = getStats()
  if (!stats[questionKey]) stats[questionKey] = { attempts: 0, correct: 0 }
  stats[questionKey].attempts++
  if (correct) stats[questionKey].correct++
  localStorage.setItem(STATS_KEY, JSON.stringify(stats))
}

export function getTopicStats(slug) {
  const topic = topicBySlug(slug)
  if (!topic) return { attempted: 0, correct: 0, total: 0 }
  const stats = getStats()
  let attempted = 0, correct = 0
  Object.entries(stats).forEach(([key, val]) => {
    if (key.startsWith(`topic_${slug}_`)) {
      attempted += val.attempts
      correct   += val.correct
    }
  })
  return { attempted, correct }
}
