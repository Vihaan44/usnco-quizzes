import { useState, useEffect, useCallback } from 'react'
import { imgUrl } from '../data'
import styles from './QuizRunner.module.css'

const LETTERS = ['A', 'B', 'C', 'D']
const REF_URL = 'https://www.acs.org/content/dam/acsorg/education/students/highschool/olympiad/examsolutions/2021-usnco-reference-page.pdf'

export default function QuizRunner({ questions, onComplete, onAnswer, title, subtitle }) {
  const [idx, setIdx]           = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers]   = useState([])
  const [elapsed, setElapsed]   = useState(0)
  const [showRef, setShowRef]   = useState(false)

  const q = questions[idx]

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const choose = useCallback((letter) => {
    if (revealed) return
    setSelected(letter)
    setRevealed(true)
  }, [revealed])

  const next = useCallback(() => {
    const record = { q, chosen: selected, correct: selected === q.answer }
    const newAnswers = [...answers, record]
    setAnswers(newAnswers)

    if (onAnswer) onAnswer(record)

    setSelected(null)
    setRevealed(false)
    if (idx + 1 >= questions.length) {
      onComplete(newAnswers, elapsed)
    } else {
      setIdx(idx + 1)
    }
  }, [q, selected, answers, idx, questions, onComplete, onAnswer, elapsed])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'a' || e.key === 'A') choose('A')
      if (e.key === 'b' || e.key === 'B') choose('B')
      if (e.key === 'c' || e.key === 'C') choose('C')
      if (e.key === 'd' || e.key === 'D') choose('D')
      if (e.key === 'Enter' && revealed) next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [choose, next, revealed])

  const progress = ((idx) / questions.length) * 100

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.topTitle}>{title}</span>
          {subtitle && <span className={styles.topSub}>{subtitle}</span>}
        </div>
        <div className={styles.topRight}>
          <button className={styles.refBtn} onClick={() => setShowRef(true)}>Reference</button>
          <span className={styles.timer}>{fmt(elapsed)}</span>
          <span className={styles.counter}>{idx + 1} / {questions.length}</span>
        </div>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.meta}>
        <span className={styles.metaTag}>{q.topic}</span>
        <span className={styles.metaTag2}>{q.year} Local · Q{q.number}</span>
      </div>

      <div className={styles.questionWrap}>
        <img
          className={styles.questionImg}
          src={imgUrl(q.folder, q.image)}
          alt={`Question ${q.number}`}
          key={q.image}
        />
      </div>

      <div className={styles.choices}>
        {LETTERS.map(letter => {
          let state = 'default'
          if (revealed) {
            if (letter === q.answer) state = 'correct'
            else if (letter === selected) state = 'wrong'
            else state = 'dim'
          } else if (letter === selected) {
            state = 'selected'
          }

          return (
            <button
              key={letter}
              className={`${styles.choice} ${styles[state]}`}
              onClick={() => choose(letter)}
              disabled={revealed && letter !== selected && letter !== q.answer}
            >
              <span className={styles.choiceLetter}>{letter}</span>
              <div className={styles.choiceImg}>
                {q.choices[letter] ? (
                  <img
                    src={imgUrl(q.folder, q.choices[letter])}
                    alt={`Choice ${letter}`}
                    key={q.choices[letter]}
                  />
                ) : (
                  <span className={styles.noImg}>—</span>
                )}
              </div>
              {revealed && letter === q.answer && (
                <span className={styles.checkmark}>✓</span>
              )}
            </button>
          )
        })}
      </div>

      {revealed && (
        <div className={styles.nextWrap}>
          <div className={styles.verdict}>
            {selected === q.answer
              ? <span className={styles.correct}>Correct!</span>
              : <span className={styles.wrong}>Incorrect — answer is <strong>{q.answer}</strong></span>
            }
          </div>
          <button className={styles.nextBtn} onClick={next}>
            {idx + 1 >= questions.length ? 'See Results' : 'Next Question'}
            <kbd className={styles.kbd}>↵</kbd>
          </button>
        </div>
      )}

      {showRef && (
        <div className={styles.refOverlay}>
          <div className={styles.refModal}>
            <div className={styles.refModalHeader}>
              <span className={styles.refTitle}>USNCO Reference</span>
              <button className={styles.closeBtn} onClick={() => setShowRef(false)}>Close</button>
            </div>
            <iframe className={styles.refIframe} src={REF_URL} title="Reference Sheet" />
          </div>
        </div>
      )}
    </div>
  )
}