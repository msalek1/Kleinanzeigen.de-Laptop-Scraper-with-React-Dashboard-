import { Link } from 'react-router-dom'
import { Laptop, BarChart3 } from 'lucide-react'

/**
 * Application header with navigation and branding.
 */
export default function Header() {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and brand */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
            <Laptop className="w-6 h-6 text-primary-600" />
            <span>Notebook Scraper</span>
          </Link>
          
          {/* Navigation */}
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <Laptop className="w-4 h-4" />
              Listings
            </Link>
            <Link
              to="/?view=stats"
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              Stats
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
