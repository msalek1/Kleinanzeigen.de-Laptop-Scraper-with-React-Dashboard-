/**
 * DatePeriodFilter Component
 * 
 * Provides quick period preset buttons and optional custom date range picker.
 */

import { useState } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ListingsParams } from '../services/api'

// Period options with labels
const PERIOD_OPTIONS = [
    { value: 'today', label: 'Today', short: '24h' },
    { value: '3days', label: 'Last 3 Days', short: '3d' },
    { value: 'week', label: 'Last Week', short: '7d' },
    { value: '2weeks', label: 'Last 2 Weeks', short: '14d' },
    { value: 'month', label: 'Last Month', short: '30d' },
    { value: '3months', label: 'Last 3 Months', short: '3m' },
    { value: 'year', label: 'Last Year', short: '1y' },
] as const

type PeriodValue = typeof PERIOD_OPTIONS[number]['value'] | undefined

interface DatePeriodFilterProps {
    /** Currently selected period */
    selectedPeriod?: ListingsParams['date_period']
    /** Custom date range (from) */
    dateFrom?: string
    /** Custom date range (to) */
    dateTo?: string
    /** Callback when period changes */
    onPeriodChange: (period: ListingsParams['date_period']) => void
    /** Callback when custom date range changes */
    onDateRangeChange?: (from: string | undefined, to: string | undefined) => void
    /** Show compact mode (just chips) or full mode (with dropdown) */
    compact?: boolean
}

/**
 * Date period filter with quick presets and optional date picker.
 */
export default function DatePeriodFilter({
    selectedPeriod,
    dateFrom,
    dateTo,
    onPeriodChange,
    onDateRangeChange,
    compact = false,
}: DatePeriodFilterProps) {
    const [showDropdown, setShowDropdown] = useState(false)
    const [showCustom, setShowCustom] = useState(false)
    const [customFrom, setCustomFrom] = useState(dateFrom || '')
    const [customTo, setCustomTo] = useState(dateTo || '')

    const handlePeriodClick = (period: PeriodValue) => {
        if (selectedPeriod === period) {
            // Toggle off if clicking same period
            onPeriodChange(undefined)
        } else {
            onPeriodChange(period)
            // Clear custom dates when selecting a preset
            if (onDateRangeChange) {
                onDateRangeChange(undefined, undefined)
            }
        }
        setShowDropdown(false)
        setShowCustom(false)
    }

    const handleCustomApply = () => {
        if (onDateRangeChange && (customFrom || customTo)) {
            onDateRangeChange(customFrom || undefined, customTo || undefined)
            onPeriodChange(undefined) // Clear period preset
        }
        setShowCustom(false)
        setShowDropdown(false)
    }

    const handleClear = () => {
        onPeriodChange(undefined)
        if (onDateRangeChange) {
            onDateRangeChange(undefined, undefined)
        }
        setCustomFrom('')
        setCustomTo('')
        setShowCustom(false)
    }

    const hasActiveFilter = selectedPeriod || dateFrom || dateTo
    const activeLabel = selectedPeriod
        ? PERIOD_OPTIONS.find(p => p.value === selectedPeriod)?.label
        : (dateFrom || dateTo)
            ? `${dateFrom || '...'} – ${dateTo || '...'}`
            : null

    if (compact) {
        // Compact mode: just chips
        return (
            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Posted:
                </span>
                {PERIOD_OPTIONS.slice(0, 5).map(({ value, short }) => (
                    <button
                        key={value}
                        onClick={() => handlePeriodClick(value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${selectedPeriod === value
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        {short}
                    </button>
                ))}
                {hasActiveFilter && (
                    <button
                        onClick={handleClear}
                        className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Clear date filter"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        )
    }

    // Full mode with dropdown
    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${hasActiveFilter
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
            >
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">
                    {activeLabel || 'Any Time'}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {showDropdown && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 mt-2 w-64 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700"
                    >
                        {/* Period presets */}
                        <div className="space-y-1 mb-3">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Quick Select</p>
                            {PERIOD_OPTIONS.map(({ value, label }) => (
                                <button
                                    key={value}
                                    onClick={() => handlePeriodClick(value)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${selectedPeriod === value
                                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-gray-200 dark:border-gray-700 my-3" />

                        {/* Custom date range */}
                        {!showCustom ? (
                            <button
                                onClick={() => setShowCustom(true)}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Custom range...
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Custom Range</p>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={customFrom}
                                        onChange={(e) => setCustomFrom(e.target.value)}
                                        className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="From"
                                    />
                                    <input
                                        type="date"
                                        value={customTo}
                                        onChange={(e) => setCustomTo(e.target.value)}
                                        className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="To"
                                    />
                                </div>
                                <button
                                    onClick={handleCustomApply}
                                    disabled={!customFrom && !customTo}
                                    className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Apply
                                </button>
                            </div>
                        )}

                        {/* Clear button */}
                        {hasActiveFilter && (
                            <>
                                <div className="border-t border-gray-200 dark:border-gray-700 my-3" />
                                <button
                                    onClick={handleClear}
                                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                    Clear date filter
                                </button>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Click outside to close */}
            {showDropdown && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                />
            )}
        </div>
    )
}
