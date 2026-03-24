import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadAllQuestions, TOPICS, recordAnswer } from '../data'
import QuizRunner from '../components/QuizRunner'
import styles from './FullExam.module.css'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickDiverseYears(pool, count) {
  // Shuffle, then pick `count` questions preferring different years
  const shuffled = shuffle(pool)
  const picked = []
  const usedYears = new Set()
  // First pass: unique years
  for (const q of shuffled) {
    if (picked.length >= count) break
    if (!usedYears.has(q.year)) {
      picked.push(q)
      usedYears.add(q.year)
    }
  }
  // Second pass: fill remaining
  for (const q of shuffled) {
    if (picked.length >= count) break
    if (!picked.includes(q)) picked.push(q)
  }
  return picked.slice(0, count)
}

function buildExam(allQuestions) {
  const exam = []
  for (const topic of TOPICS) {
    const pool = allQuestions.filter(
      q => q.topic === topic.label && q.answer !== '?'
    )
    const picked = pickDiverseYears(pool, 6)
    exam.push(...picked)
  }
  return exam
}

export default function FullExam() {
  const nav = useNavigate()
  const [questions, setQuestions] = useState(null)
  const [error, setError]         = useState(null)
  const [started, setStarted]     = useState(false)

  useEffect(() => {
    loadAllQuestions()
      .then(all => setQuestions(buildExam(all)))
      .catch(e => setError(e.message))
  }, [])

  function handleComplete(answers, elapsed) {
    answers.forEach(({ q, correct }) => {
      recordAnswer(`exam_${q.year}_${q.number}`, correct)
    })
    const correct = answers.filter(r => r.correct).length
    nav('/results', {
      state: { results: answers, correct, total: answers.length, title: 'Full Exam', elapsed }
    })
  }

  if (error) return <div className={styles.err}>Error: {error}</div>

  if (!questions) {
    return (
      <div className={styles.loading}>
        <span className={styles.spinner}/>
        Building your exam…
      </div>
    )
  }

  if (!started) {
    const topicBreakdown = TOPICS.map(topic => {
      const qs = questions.filter(q => q.topic === topic.label)
      const years = [...new Set(qs.map(q => q.year))].sort()
      return { topic, qs, years }
    })

    return (
      <div className={styles.lobby}>
        <button className={styles.back} onClick={() => nav('/')}>← Back</button>
        <div className={styles.lobbyCard}>
          <h1 className={styles.lobbyTitle}>Full Exam</h1>
          <p className={styles.lobbyDesc}>
            A randomised 60-question exam built from all years.<br/>
            6 questions per topic block, drawn from different years.
          </p>

          <div className={styles.breakdown}>
            {topicBreakdown.map(({ topic, qs, years }) => (
              <div key={topic.slug} className={styles.bRow}>
                <span className={styles.bIcon}>{topic.icon}</span>
                <span className={styles.bLabel}>{topic.label}</span>
                <span className={styles.bYears}>{years.join(', ')}</span>
                <span className={styles.bCount}>{qs.length} Q</span>
              </div>
            ))}
          </div>

          <button className={styles.startBtn} onClick={() => setStarted(true)}>
            Start Exam
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.backBarInline}>
        <button className={styles.back} onClick={() => nav('/')}>← Exit</button>
      </div>
      <QuizRunner
        questions={questions}
        onComplete={handleComplete}
        title="Full Exam"
        subtitle="60 questions · mixed years"
      />
    </div>
  )
}
