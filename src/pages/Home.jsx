import { useNavigate } from 'react-router-dom'
import { TOPICS, getTopicStats } from '../data'
import styles from './Home.module.css'
import AuthButton from '../components/AuthButton'

export default function Home() {
  const nav = useNavigate()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMono}>USNCO</span>
            <span className={styles.logoSub}>Question Bank</span>
          </div>
          <p className={styles.tagline}>
            2000 – 2025 · Local Exams · 1,560 Questions
          </p>
        </div>
        <div className={styles.headerActions}>
          <AuthButton />
          <button className={styles.btnSecondary} onClick={() => nav('/analytics')}>
            Analytics
          </button>
          <button className={styles.btnPrimary} onClick={() => nav('/exam')}>
            Full Exam Mode
            <span className={styles.btnTag}>60 Q · 110 min</span>
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Practice by Topic</h2>
          <p className={styles.sectionSub}>Questions pulled from all years, randomised within each block</p>
        </div>

        <div className={styles.grid}>
          {TOPICS.map((topic, i) => {
            const stats = getTopicStats(topic.slug)
            const pct = stats.attempted > 0
              ? Math.round((stats.correct / stats.attempted) * 100)
              : null

            return (
              <button
                key={topic.slug}
                className={styles.card}
                onClick={() => nav(`/topic/${topic.slug}`)}
                style={{ '--i': i }}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardIcon}>{topic.icon}</span>
                  <span className={styles.cardRange}>Q{topic.range[0]}–{topic.range[1]}</span>
                </div>
                <h3 className={styles.cardTitle}>{topic.label}</h3>
                <div className={styles.cardBottom}>
                  {pct !== null ? (
                    <>
                      <div className={styles.bar}>
                        <div className={styles.barFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.cardStat}>{pct}% · {stats.attempted} attempted</span>
                    </>
                  ) : (
                    <span className={styles.cardStatEmpty}>Not started</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}