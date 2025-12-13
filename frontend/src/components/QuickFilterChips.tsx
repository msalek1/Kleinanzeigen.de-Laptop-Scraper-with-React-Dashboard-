/**
 * QuickFilterChips Component
 * 
 * Displays popular hardware tags as clickable filter chips.
 * Allows quick filtering by common specs like CPU, RAM, GPU.
 */

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { X, Cpu, HardDrive, MonitorSmartphone, Palette, Tag } from 'lucide-react'
import { tagsApi, Tag as TagType } from '../services/api'

// Category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    cpu_model: <Cpu className="w-3 h-3" />,
    cpu_brand: <Cpu className="w-3 h-3" />,
    ram: <HardDrive className="w-3 h-3" />,
    storage: <HardDrive className="w-3 h-3" />,
    gpu: <Palette className="w-3 h-3" />,
    screen_size: <MonitorSmartphone className="w-3 h-3" />,
    brand: <Tag className="w-3 h-3" />,
    refresh_rate: <MonitorSmartphone className="w-3 h-3" />,
    os: <Tag className="w-3 h-3" />,
}

// Category colors
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    cpu_model: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700' },
    cpu_brand: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700' },
    ram: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-700' },
    storage: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700' },
    gpu: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700' },
    screen_size: { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-700' },
    brand: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-700' },
    refresh_rate: { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-700' },
    os: { bg: 'bg-gray-50 dark:bg-gray-900/20', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-700' },
}

interface QuickFilterChipsProps {
    /** Currently selected tag values (comma-separated in parent state) */
    selectedTags: string[]
    /** Callback when tags selection changes */
    onTagsChange: (tags: string[]) => void
    /** Maximum number of chips to display */
    maxChips?: number
    /** Categories to show (null = all) */
    categories?: string[] | null
}

/**
 * Horizontal chip bar for quick hardware tag filtering.
 */
export default function QuickFilterChips({
    selectedTags,
    onTagsChange,
    maxChips = 15,
    categories = null,
}: QuickFilterChipsProps) {
    const [popularTags, setPopularTags] = useState<TagType[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Fetch popular tags on mount
    useEffect(() => {
        const fetchTags = async () => {
            try {
                const response = await tagsApi.getPopularTags(30)
                setPopularTags(response.data)
            } catch (err) {
                console.error('Failed to fetch popular tags:', err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchTags()
    }, [])

    // Filter and limit tags
    const displayTags = useMemo(() => {
        let filtered = popularTags

        // Filter by categories if specified
        if (categories && categories.length > 0) {
            filtered = filtered.filter(tag => categories.includes(tag.category))
        }

        // Limit number of chips
        return filtered.slice(0, maxChips)
    }, [popularTags, categories, maxChips])

    const toggleTag = (tagValue: string) => {
        if (selectedTags.includes(tagValue)) {
            onTagsChange(selectedTags.filter(t => t !== tagValue))
        } else {
            onTagsChange([...selectedTags, tagValue])
        }
    }

    const clearAll = () => {
        onTagsChange([])
    }

    if (isLoading) {
        return (
            <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"
                    />
                ))}
            </div>
        )
    }

    if (displayTags.length === 0) return null

    return (
        <div className="mb-4">
            <div className="flex flex-wrap gap-2 items-center">
                {displayTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.value)
                    const colors = CATEGORY_COLORS[tag.category] || CATEGORY_COLORS.os
                    const icon = CATEGORY_ICONS[tag.category]

                    return (
                        <motion.button
                            key={`${tag.category}-${tag.value}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleTag(tag.value)}
                            className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-all duration-200 border
                ${isSelected
                                    ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ring-offset-1 ring-current/30`
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }
              `}
                        >
                            {icon}
                            <span>{tag.display_name || tag.value}</span>
                            {tag.count !== undefined && (
                                <span className="text-[10px] opacity-60">({tag.count})</span>
                            )}
                        </motion.button>
                    )
                })}

                {/* Clear all button */}
                {selectedTags.length > 0 && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={clearAll}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
              bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 
              border border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                    >
                        <X className="w-3 h-3" />
                        Clear ({selectedTags.length})
                    </motion.button>
                )}
            </div>
        </div>
    )
}
