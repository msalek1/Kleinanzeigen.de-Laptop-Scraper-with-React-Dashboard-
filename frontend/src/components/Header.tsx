import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Laptop, BarChart3, Settings, Heart, Bell } from 'lucide-react'
import { motion } from 'framer-motion'
import { useFavorites, usePriceAlerts } from '../hooks/useFavorites'
import PriceAlertModal from './PriceAlertModal'

/**
 * Application header with navigation and branding.
 */
export default function Header() {
  const location = useLocation()
  const { favoritesCount } = useFavorites()
  const { activeAlertsCount } = usePriceAlerts()
  const [showAlertModal, setShowAlertModal] = useState(false)
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' && !location.search.includes('view=stats')
    if (path === '/stats') return location.search.includes('view=stats')
    return location.pathname.startsWith(path)
  }

  return (
    <>
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo and brand */}
            <Link to="/" className="flex items-center gap-2 group">
              <motion.div
                whileHover={{ rotate: 20 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Laptop className="w-6 h-6 text-primary-600" />
              </motion.div>
              <span className="text-xl font-bold text-gray-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                Notebook Scraper
              </span>
            </Link>
            
            {/* Navigation */}
            <nav className="flex items-center gap-1">
              <NavLink to="/" icon={Laptop} label="Listings" active={isActive('/')} />
              <NavLink to="/?view=stats" icon={BarChart3} label="Stats" active={isActive('/stats')} />
              
              {/* Favorites with badge */}
              <Link
                to="/favorites"
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive('/favorites')
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                }`}
              >
                {isActive('/favorites') && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-red-50 dark:bg-red-900/20 rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Heart className={`w-4 h-4 ${favoritesCount > 0 ? 'fill-current' : ''}`} />
                  Favorites
                  {favoritesCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {favoritesCount > 9 ? '9+' : favoritesCount}
                    </span>
                  )}
                </span>
              </Link>
              
              {/* Price Alerts button */}
              <button
                onClick={() => setShowAlertModal(true)}
                className="relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Alerts</span>
                {activeAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {activeAlertsCount > 9 ? '9+' : activeAlertsCount}
                  </span>
                )}
              </button>
              
              <NavLink to="/admin" icon={Settings} label="Admin" active={isActive('/admin')} />
            </nav>
          </div>
        </div>
      </motion.header>
      
      {/* Price Alert Modal */}
      <PriceAlertModal isOpen={showAlertModal} onClose={() => setShowAlertModal(false)} />
    </>
  )
}

function NavLink({ to, icon: Icon, label, active }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        active 
          ? 'text-primary-600 dark:text-primary-400' 
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {active && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-0 bg-primary-50 dark:bg-primary-900/20 rounded-full"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {label}
      </span>
    </Link>
  )
}
