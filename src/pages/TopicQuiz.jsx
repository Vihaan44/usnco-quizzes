import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { loadAllQuestions, topicBySlug, recordAnswer } from '../data'
import QuizRunner from '../components/QuizRunner'
import styles from './TopicQuiz.module.css'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function TopicQuiz() {
  const { topicSlug } = useParams()
  const nav = useNavigate()
  const topic = topicBySlug(topicSlug)

  const [questions, setQuestions] = useState(null)
  const [error, setError]         = useState(null)
  const [done, setDone]           = useState(false)
  const [results, setResults]     = useState(null)

  useEffect(() => {
    if (!topic) return
    loadAllQuestions()
      .then(all => {
        const filtered = all.filter(q => q.topic === topic.label && q.answer !== '?')
        setQuestions(shuffle(filtered))
      })
      .catch(e => setError(e.message))
  }, [topic])

  if (!topic) return <div className={styles.err}>Topic not found.</div>
  if (error)  return <div className={styles.err}>Error: {error}</div>
  if (!questions) return <div className={styles.loading}><span className={styles.spinner}/>Loading questions…</div>

  if (done && results) {
    const correct = results.filter(r => r.correct).length
    nav('/results', { state: { results, correct, total: results.length, title: topic.label } })
    return null
  }

  function handleComplete(answers) {
    // Record stats
    answers.forEach(({ q, correct }) => {
      recordAnswer(`topic_${topicSlug}_${q.year}_${q.number}`, correct)
    })
    setResults(answers)
    setDone(true)
  }

  return (
    <div>
      <div className={styles.backBar}>
        <button className={styles.back} onClick={() => nav('/')}>← Back</button>
      </div>
      <QuizRunner
        questions={questions}
        onComplete={handleComplete}
        title={`${topic.icon} ${topic.label}`}
        subtitle={`${questions.length} questions · all years`}
      />
    </div>
  )
}
