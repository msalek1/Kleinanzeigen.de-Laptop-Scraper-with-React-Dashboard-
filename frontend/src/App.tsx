import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import FavoritesPage from './pages/FavoritesPage'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
