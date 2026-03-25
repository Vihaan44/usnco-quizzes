import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import TopicQuiz from './pages/TopicQuiz'
import FullExam from './pages/FullExam'
import Results from './pages/Results'
import AuthButton from './components/AuthButton'
import './index.css'

export default function App() {
  return (
    <HashRouter>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <AuthButton />
      </div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/topic/:topicSlug" element={<TopicQuiz />} />
        <Route path="/exam" element={<FullExam />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </HashRouter>
  )
}