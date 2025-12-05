import { TrendingUp, TrendingDown, MapPin, DollarSign, BarChart3 } from 'lucide-react'
import { useStats } from '../hooks/useApi'
import { motion } from 'framer-motion'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface StatCardProps {
  title: string
  value: number | string
  prefix?: string
  suffix?: string
  icon: React.ElementType
  className?: string
  trend?: 'up' | 'down' | 'neutral'
  delay?: number
}

function StatCard({ title, value, prefix, suffix, icon: Icon, className, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, type: "spring", stiffness: 100 }}
      className={cn(
        "relative overflow-hidden bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md transition-all duration-300 group",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-primary-600 transition-colors">
          {title}
        </h3>
        <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
          <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 transition-colors" />
        </div>
      </div>
      
      <div className="flex items-baseline gap-1">
        {prefix && <span className="text-xl font-semibold text-gray-900 dark:text-white">{prefix}</span>}
        {typeof value === 'number' ? (
            <AnimatedNumber 
                value={value} 
                className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight"
                springOptions={{
                    bounce: 0,
                    duration: 2000,
                }}
            />
        ) : (
            <span className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</span>
        )}
        {suffix && <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-1">{suffix}</span>}
      </div>
    </motion.div>
  )
}

/**
 * Statistics panel showing aggregate listing data.
 * Displays total count, price statistics, and top cities.
 */
export default function StatsPanel() {
  const { data, isLoading, error } = useStats()
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
         {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
         ))}
      </div>
    )
  }
  
  if (error || !data) return null
  
  const stats = data.data
  
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Market Overview
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Listings"
          value={stats.total_listings}
          icon={BarChart3}
          delay={0.1}
        />
        
        <StatCard
          title="Average Price"
          value={stats.average_price ?? 0}
          prefix="€"
          icon={DollarSign}
          delay={0.2}
        />
        
        <StatCard
          title="Min Price"
          value={stats.min_price ?? 0}
          prefix="€"
          icon={TrendingDown}
          className="border-l-4 border-l-green-500"
          delay={0.3}
        />
        
        <StatCard
          title="Max Price"
          value={stats.max_price ?? 0}
          prefix="€"
          icon={TrendingUp}
          className="border-l-4 border-l-red-500"
          delay={0.4}
        />
      </div>
      
      {/* Top Cities Pill Cloud */}
      {stats.listings_by_city.length > 0 && (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50"
        >
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Active Regions
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.listings_by_city.map(({ city, count }, idx) => (
              <motion.div
                key={city}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + (idx * 0.05) }}
                className="group flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-700 transition-all duration-300"
              >
                <span className="text-gray-700 dark:text-gray-200 font-medium">{city}</span>
                <span className="bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold px-2 py-0.5 rounded-full group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  {count}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </section>
  )
}
