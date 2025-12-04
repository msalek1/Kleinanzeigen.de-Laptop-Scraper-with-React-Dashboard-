import { Outlet } from 'react-router-dom'
import Header from './Header'

/**
 * Main layout component wrapping all pages.
 * Provides consistent header, navigation, and footer across the app.
 */
export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 dark:border-gray-700 py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Kleinanzeigen Notebook Scraper — For personal research and educational use only.</p>
          <p className="mt-1">Always respect Terms of Service and robots.txt when scraping.</p>
        </div>
      </footer>
    </div>
  )
}
