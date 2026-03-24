import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import TopicQuiz from './pages/TopicQuiz'
import FullExam from './pages/FullExam'
import Results from './pages/Results'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/topic/:topicSlug" element={<TopicQuiz />} />
        <Route path="/exam" element={<FullExam />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </BrowserRouter>
  )
}
