import { db, auth } from './firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'

const BASE = '/usnco-quizzes/usnco_results'

export function imgUrl(folder, filename) {
  if (!filename) return ''
  return `${BASE}/${folder}/${filename}`
}

export async function loadIndex() {
  const res = await fetch(`${BASE}/index.json`)
  return res.json()
}

export async function loadExamMeta(folder) {
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
        meta.questions.forEach(q => all.push({ ...q, folder }))
      } catch (e) {
        console.warn('Could not load', folder, e)
      }
    })
  )
  return all
}

export const TOPICS = [
  { slug: 'stoichiometry', label: 'Stoichiometry & Solutions',      range: [1,6],   icon: '⚗️' },
  { slug: 'descriptive',   label: 'Descriptive & Laboratory',       range: [7,12],  icon: '🧪' },
  { slug: 'states',        label: 'States of Matter',               range: [13,18], icon: '🌡️' },
  { slug: 'thermo',        label: 'Thermodynamics',                  range: [19,24], icon: '🔥' },
  { slug: 'kinetics',      label: 'Kinetics',                        range: [25,30], icon: '⚡' },
  { slug: 'equilibrium',   label: 'Equilibrium',                     range: [31,36], icon: '⚖️' },
  { slug: 'redox',         label: 'Oxidation-Reduction',             range: [37,42], icon: '🔋' },
  { slug: 'atomic',        label: 'Atomic Structure & Periodicity',  range: [43,48], icon: '⚛️' },
  { slug: 'bonding',       label: 'Bonding & Molecular Structure',   range: [49,54], icon: '🔗' },
  { slug: 'organic',       label: 'Organic & Biochemistry',          range: [55,60], icon: '🧬' },
]

export function topicBySlug(slug) {
  return TOPICS.find(t => t.slug === slug)
}

export function topicByLabel(label) {
  return TOPICS.find(t => t.label === label)
}

// ── localStorage helpers (local cache) ──
const STATS_KEY = 'usnco_stats'

export function getStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY)) || {} }
  catch { return {} }
}

// ── Firestore helpers ──
async function saveStatsToFirestore(stats) {
  const user = auth.currentUser
  if (!user) return
  try {
    await setDoc(doc(db, 'users', user.uid, 'data', 'stats'), stats)
  } catch (e) {
    console.warn('Firestore save failed', e)
  }
}

export async function loadStatsFromFirestore() {
  const user = auth.currentUser
  if (!user) return null
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'data', 'stats'))
    return snap.exists() ? snap.data() : {}
  } catch (e) {
    console.warn('Firestore load failed', e)
    return null
  }
}

export async function recordAnswer(questionKey, correct) {
  const stats = getStats()
  if (!stats[questionKey]) stats[questionKey] = { attempts: 0, correct: 0 }
  stats[questionKey].attempts++
  if (correct) stats[questionKey].correct++
  localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  await saveStatsToFirestore(stats)
}

export async function recordExam(score, total, elapsed) {
  const user = auth.currentUser
  if (!user) return
  try {
    const ref = doc(db, 'users', user.uid, 'exams', String(Date.now()))
    await setDoc(ref, {
      score,
      total,
      pct: Math.round((score / total) * 100),
      elapsed,
      date: new Date().toISOString()
    })
  } catch (e) {
    console.warn('Firestore exam save failed', e)
  }
}

export function getTopicStats(slug) {
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