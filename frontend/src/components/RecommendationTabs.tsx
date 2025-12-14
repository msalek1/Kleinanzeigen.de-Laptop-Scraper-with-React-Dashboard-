/**
 * RecommendationTabs Component
 * 
 * Tab bar for Must See / Recommended / All views.
 * Integrates with the AI recommendation engine.
 */

import { motion } from 'framer-motion'
import { Flame, ThumbsUp, LayoutList, Sparkles } from 'lucide-react'

export type RecommendationView = 'must_see' | 'recommended' | 'all'

interface RecommendationTabsProps {
    /** Currently selected view */
    selectedView: RecommendationView
    /** Callback when view changes */
    onViewChange: (view: RecommendationView) => void
    /** Whether preferences are configured */
    hasPreferences: boolean
    /** Must-see count */
    mustSeeCount?: number
    /** Recommended count */
    recommendedCount?: number
}

const TAB_CONFIG: Record<RecommendationView, {
    label: string
    icon: React.ReactNode
    color: string
    bgColor: string
    hoverColor: string
}> = {
    must_see: {
        label: 'Must See',
        icon: <Flame className="w-4 h-4" />,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-gradient-to-r from-orange-500 to-red-500',
        hoverColor: 'hover:bg-orange-50 dark:hover:bg-orange-900/20',
    },
    recommended: {
        label: 'Recommended',
        icon: <ThumbsUp className="w-4 h-4" />,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-gradient-to-r from-blue-500 to-indigo-500',
        hoverColor: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
    },
    all: {
        label: 'All Listings',
        icon: <LayoutList className="w-4 h-4" />,
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-600',
        hoverColor: 'hover:bg-gray-50 dark:hover:bg-gray-700',
    },
}

/**
 * Tab bar for switching between recommendation views
 */
export default function RecommendationTabs({
    selectedView,
    onViewChange,
    hasPreferences,
    mustSeeCount = 0,
    recommendedCount = 0,
}: RecommendationTabsProps) {
    const tabs: { id: RecommendationView; count?: number }[] = [
        { id: 'must_see', count: mustSeeCount },
        { id: 'recommended', count: recommendedCount },
        { id: 'all' },
    ]

    return (
        <div className="relative mb-6">
            {/* Preferences hint */}
            {!hasPreferences && selectedView !== 'all' && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"
                >
                    <Sparkles className="w-4 h-4" />
                    <span>Set up your preferences to get personalized recommendations!</span>
                </motion.div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                {tabs.map((tab) => {
                    const config = TAB_CONFIG[tab.id]
                    const isActive = selectedView === tab.id

                    return (
                        <motion.button
                            key={tab.id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => onViewChange(tab.id)}
                            className={`
                relative flex-1 flex items-center justify-center gap-2 px-4 py-3 
                rounded-lg text-sm font-semibold transition-all duration-300
                ${isActive
                                    ? 'text-white shadow-lg'
                                    : `text-gray-600 dark:text-gray-400 ${config.hoverColor}`
                                }
              `}
                        >
                            {/* Active background */}
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className={`absolute inset-0 ${config.bgColor} rounded-lg`}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}

                            {/* Content */}
                            <span className="relative z-10 flex items-center gap-2">
                                {config.icon}
                                <span>{config.label}</span>
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className={`
                    text-xs px-2 py-0.5 rounded-full font-bold
                    ${isActive
                                            ? 'bg-white/20'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                        }
                  `}>
                                        {tab.count}
                                    </span>
                                )}
                            </span>
                        </motion.button>
                    )
                })}
            </div>
        </div>
    )
}
