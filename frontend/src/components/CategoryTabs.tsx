/**
 * CategoryTabs Component
 * 
 * Tab-based navigation for laptop category filtering.
 * Displays gaming, business, ultrabook, and other laptop categories.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
    Gamepad2,
    Briefcase,
    Laptop,
    Wrench,
    RefreshCw,
    LayoutGrid
} from 'lucide-react'
import { laptopCategoriesApi, LaptopCategoryData } from '../services/api'

// Laptop category metadata
const CATEGORY_CONFIG: Record<string, {
    label: string
    icon: React.ReactNode
    color: string
    bgColor: string
}> = {
    all: {
        label: 'All Laptops',
        icon: <LayoutGrid className="w-4 h-4" />,
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-700',
    },
    gaming: {
        label: 'Gaming',
        icon: <Gamepad2 className="w-4 h-4" />,
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    business: {
        label: 'Business',
        icon: <Briefcase className="w-4 h-4" />,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    ultrabook: {
        label: 'Ultrabook',
        icon: <Laptop className="w-4 h-4" />,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    workstation: {
        label: 'Workstation',
        icon: <Wrench className="w-4 h-4" />,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
    '2in1': {
        label: '2-in-1',
        icon: <RefreshCw className="w-4 h-4" />,
        color: 'text-teal-600 dark:text-teal-400',
        bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    },
    other: {
        label: 'Other',
        icon: <Laptop className="w-4 h-4" />,
        color: 'text-gray-500 dark:text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-700',
    },
}

interface CategoryTabsProps {
    /** Currently selected category */
    selectedCategory: string | undefined
    /** Callback when category changes */
    onCategoryChange: (category: string | undefined) => void
    /** Whether to show counts */
    showCounts?: boolean
}

/**
 * Tab bar for filtering laptops by category (gaming, business, etc.)
 */
export default function CategoryTabs({
    selectedCategory,
    onCategoryChange,
    showCounts = true,
}: CategoryTabsProps) {
    const [categories, setCategories] = useState<LaptopCategoryData[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Fetch category counts on mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await laptopCategoriesApi.getCategories()
                setCategories(response.data)
            } catch (err) {
                console.error('Failed to fetch laptop categories:', err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchCategories()
    }, [])

    // Build tabs with counts
    const tabs = [
        { id: 'all', count: categories.reduce((sum, c) => sum + c.count, 0) },
        ...categories.map(c => ({ id: c.category, count: c.count })),
    ].filter(tab => CATEGORY_CONFIG[tab.id])

    // Determine active tab
    const activeTab = selectedCategory || 'all'

    return (
        <div className="flex flex-wrap gap-2 mb-4">
            {tabs.map((tab) => {
                const config = CATEGORY_CONFIG[tab.id]
                const isActive = activeTab === tab.id

                return (
                    <motion.button
                        key={tab.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onCategoryChange(tab.id === 'all' ? undefined : tab.id)}
                        className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-200 border
              ${isActive
                                ? `${config.bgColor} ${config.color} border-current shadow-sm`
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }
            `}
                    >
                        <span className={isActive ? config.color : ''}>{config.icon}</span>
                        <span>{config.label}</span>
                        {showCounts && !isLoading && (
                            <span className={`
                text-xs px-1.5 py-0.5 rounded-full
                ${isActive
                                    ? 'bg-white/50 dark:bg-black/20'
                                    : 'bg-gray-100 dark:bg-gray-700'
                                }
              `}>
                                {tab.count.toLocaleString()}
                            </span>
                        )}
                    </motion.button>
                )
            })}
        </div>
    )
}
