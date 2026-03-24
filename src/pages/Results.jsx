import { useLocation, useNavigate } from 'react-router-dom'
import { TOPICS } from '../data'
import styles from './Results.module.css'

export default function Results() {
  const { state } = useLocation()
  const nav = useNavigate()

  if (!state) { nav('/'); return null }

  const { results, correct, total, title, elapsed } = state
  const pct = Math.round((correct / total) * 100)

  const fmt = s => s ? `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : null

  // Per-topic breakdown
  const topicBreakdown = TOPICS.map(topic => {
    const qs = results.filter(r => r.q.topic === topic.label)
    if (!qs.length) return null
    const c = qs.filter(r => r.correct).length
    return { topic, correct: c, total: qs.length, pct: Math.round((c/qs.length)*100) }
  }).filter(Boolean)

  let grade = ''
  if (pct >= 90) grade = 'Excellent'
  else if (pct >= 75) grade = 'Strong'
  else if (pct >= 60) grade = 'Good'
  else if (pct >= 45) grade = 'Keep practicing'
  else grade = 'Needs work'

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <button className={styles.back} onClick={() => nav('/')}>← Home</button>

        <div className={styles.scoreCard}>
          <p className={styles.examTitle}>{title}</p>
          <div className={styles.bigScore}>{correct}<span>/{total}</span></div>
          <div className={styles.pct}>{pct}%</div>
          <div className={styles.grade}>{grade}</div>
          {fmt(elapsed) && (
            <div className={styles.time}>Time: {fmt(elapsed)}</div>
          )}
        </div>

        {topicBreakdown.length > 1 && (
          <div className={styles.breakdown}>
            <h2 className={styles.breakdownTitle}>By Topic</h2>
            {topicBreakdown.map(({ topic, correct: c, total: t, pct: p }) => (
              <div key={topic.slug} className={styles.bRow}>
                <span className={styles.bIcon}>{topic.icon}</span>
                <span className={styles.bLabel}>{topic.label}</span>
                <div className={styles.bBar}>
                  <div className={styles.bFill} style={{
                    width: `${p}%`,
                    background: p >= 67 ? 'var(--accent2)' : p >= 40 ? 'var(--gold)' : 'var(--danger)'
                  }}/>
                </div>
                <span className={styles.bStat}>{c}/{t}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.btnPrimary} onClick={() => nav('/exam')}>
            New Exam
          </button>
          <button className={styles.btnSecondary} onClick={() => nav('/')}>
            Practice by Topic
          </button>
        </div>
      </div>
    </div>
  )
}
