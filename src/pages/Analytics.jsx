import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../AuthContext'
import { TOPICS, loadStatsFromFirestore } from '../data'
import AuthButton from '../components/AuthButton'
import styles from './Analytics.module.css'

function fmt(s) {
  if (!s) return '—'
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function Analytics() {
  const { user } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [stats, setStats] = useState(null)
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    async function load() {
      const [firestoreStats, examSnap] = await Promise.all([
        loadStatsFromFirestore(),
        getDocs(collection(db, 'users', user.uid, 'exams'))
      ])
      setStats(firestoreStats || {})
      const examList = []
      examSnap.forEach(d => examList.push(d.data()))
      examList.sort((a, b) => new Date(b.date) - new Date(a.date))
      setExams(examList)
      setLoading(false)
    }
    load()
  }, [user, location])

  const topicStats = TOPICS.map(topic => {
    let attempted = 0, correct = 0
    if (stats) {
      Object.entries(stats).forEach(([key, val]) => {
        if (key.startsWith(`topic_${topic.slug}_`)) {
          attempted += val.attempts
          correct += val.correct
        }
      })
    }
    const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : null
    return { topic, attempted, correct, pct }
  })

  const totalAttempted = topicStats.reduce((s, t) => s + t.attempted, 0)
  const totalCorrect = topicStats.reduce((s, t) => s + t.correct, 0)
  const overallPct = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : null
  const bestExam = exams.length ? exams.reduce((b, e) => e.pct > b.pct ? e : b) : null
  const avgExamPct = exams.length ? Math.round(exams.reduce((s, e) => s + e.pct, 0) / exams.length) : null

  if (!user) {
    return (
      <div className={styles.locked}>
        <div className={styles.lockedCard}>
          <div className={styles.lockedIcon}>📊</div>
          <h1 className={styles.lockedTitle}>Analytics</h1>
          <p className={styles.lockedDesc}>Sign in to track your progress across devices and see detailed analytics.</p>
          <AuthButton />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <span className={styles.spinner} />
        Loading your analytics…
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <button className={styles.back} onClick={() => nav('/')}>← Home</button>
          <AuthButton />
        </div>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Analytics</h1>
          <p className={styles.pageSub}>{user.displayName}</p>
        </div>

        {/* Summary cards */}
        <div className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryVal}>{totalAttempted}</div>
            <div className={styles.summaryLabel}>Questions Answered</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryVal}>{totalCorrect}</div>
            <div className={styles.summaryLabel}>Correct Answers</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryVal}>{overallPct !== null ? `${overallPct}%` : '—'}</div>
            <div className={styles.summaryLabel}>Overall Accuracy</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryVal}>{exams.length}</div>
            <div className={styles.summaryLabel}>Full Exams Taken</div>
          </div>
          {avgExamPct !== null && (
            <div className={styles.summaryCard}>
              <div className={styles.summaryVal}>{avgExamPct}%</div>
              <div className={styles.summaryLabel}>Avg Exam Score</div>
            </div>
          )}
          {bestExam && (
            <div className={styles.summaryCard}>
              <div className={styles.summaryVal}>{bestExam.pct}%</div>
              <div className={styles.summaryLabel}>Best Exam Score</div>
            </div>
          )}
        </div>

        {/* Topic breakdown */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>By Topic</h2>
          <div className={styles.topicList}>
            {topicStats.map(({ topic, attempted, correct, pct }) => (
              <div key={topic.slug} className={styles.topicRow}>
                <span className={styles.topicIcon}>{topic.icon}</span>
                <span className={styles.topicLabel}>{topic.label}</span>
                <div className={styles.topicBarWrap}>
                  <div
                    className={styles.topicBar}
                    style={{
                      width: `${pct ?? 0}%`,
                      background: pct === null ? 'var(--bg3)' : pct >= 67 ? 'var(--accent2)' : pct >= 40 ? 'var(--gold)' : 'var(--danger)'
                    }}
                  />
                </div>
                <span className={styles.topicPct}>{pct !== null ? `${pct}%` : '—'}</span>
                <span className={styles.topicCount}>
                  {attempted > 0 ? `${correct}/${attempted}` : 'Not started'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Exam history */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Exam History</h2>
          {exams.length === 0 ? (
            <p className={styles.empty}>No full exams taken yet.</p>
          ) : (
            <div className={styles.examList}>
              {exams.map((exam, i) => (
                <div key={i} className={styles.examRow}>
                  <span className={styles.examDate}>
                    {new Date(exam.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className={styles.examScore}>{exam.score}/{exam.total}</span>
                  <div className={styles.examBarWrap}>
                    <div
                      className={styles.examBar}
                      style={{
                        width: `${exam.pct}%`,
                        background: exam.pct >= 67 ? 'var(--accent2)' : exam.pct >= 40 ? 'var(--gold)' : 'var(--danger)'
                      }}
                    />
                  </div>
                  <span className={styles.examPct}>{exam.pct}%</span>
                  <span className={styles.examTime}>{fmt(exam.elapsed)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}