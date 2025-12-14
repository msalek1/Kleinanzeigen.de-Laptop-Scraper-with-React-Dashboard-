/**
 * PreferencesPanel Component
 * 
 * Modal/panel for configuring user recommendation preferences.
 * Allows setting keywords, price range, brands, and weight sliders.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X,
    Settings,
    Tag,
    Euro,
    Building2,
    Sliders,
    Save,
    Sparkles,
    RotateCcw
} from 'lucide-react'
import {
    recommendationApi,
    UserPreferences,
    UserPreferencesInput
} from '../services/api'

// Common laptop brands
const BRAND_OPTIONS = [
    'Lenovo', 'Dell', 'HP', 'ASUS', 'Acer', 'Apple',
    'MSI', 'Razer', 'Samsung', 'Microsoft', 'Huawei', 'LG'
]

// Laptop categories
const CATEGORY_OPTIONS = [
    { id: 'gaming', label: 'Gaming', emoji: '🎮' },
    { id: 'business', label: 'Business', emoji: '💼' },
    { id: 'ultrabook', label: 'Ultrabook', emoji: '✨' },
    { id: 'workstation', label: 'Workstation', emoji: '🔧' },
    { id: '2in1', label: '2-in-1', emoji: '🔄' },
]

interface PreferencesPanelProps {
    isOpen: boolean
    onClose: () => void
    onSave?: (prefs: UserPreferences) => void
}

export default function PreferencesPanel({
    isOpen,
    onClose,
    onSave
}: PreferencesPanelProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [keywords, setKeywords] = useState<string[]>([])
    const [keywordInput, setKeywordInput] = useState('')
    const [minPrice, setMinPrice] = useState<number | null>(null)
    const [maxPrice, setMaxPrice] = useState<number | null>(null)
    const [brands, setBrands] = useState<string[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [weights, setWeights] = useState({
        price: 0.3,
        specs: 0.4,
        brand: 0.3,
    })

    // Load preferences on open
    useEffect(() => {
        if (isOpen) {
            loadPreferences()
        }
    }, [isOpen])

    const loadPreferences = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const { data } = await recommendationApi.getPreferences()
            setKeywords(data.keywords || [])
            setMinPrice(data.min_price)
            setMaxPrice(data.max_price)
            setBrands(data.brands || [])
            setCategories(data.laptop_categories || [])
            setWeights(data.weights || { price: 0.3, specs: 0.4, brand: 0.3 })
        } catch (err) {
            console.error('Failed to load preferences:', err)
            setError('Failed to load preferences')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        setError(null)
        try {
            const input: UserPreferencesInput = {
                keywords,
                min_price: minPrice,
                max_price: maxPrice,
                brands,
                laptop_categories: categories,
                weights,
            }
            const { data } = await recommendationApi.savePreferences(input)
            onSave?.(data)
            onClose()
        } catch (err) {
            console.error('Failed to save preferences:', err)
            setError('Failed to save preferences')
        } finally {
            setIsSaving(false)
        }
    }

    const handleAddKeyword = () => {
        const keyword = keywordInput.trim().toLowerCase()
        if (keyword && !keywords.includes(keyword)) {
            setKeywords([...keywords, keyword])
            setKeywordInput('')
        }
    }

    const handleRemoveKeyword = (keyword: string) => {
        setKeywords(keywords.filter(k => k !== keyword))
    }

    const toggleBrand = (brand: string) => {
        if (brands.includes(brand)) {
            setBrands(brands.filter(b => b !== brand))
        } else {
            setBrands([...brands, brand])
        }
    }

    const toggleCategory = (category: string) => {
        if (categories.includes(category)) {
            setCategories(categories.filter(c => c !== category))
        } else {
            setCategories([...categories, category])
        }
    }

    const handleReset = () => {
        setKeywords([])
        setMinPrice(null)
        setMaxPrice(null)
        setBrands([])
        setCategories([])
        setWeights({ price: 0.3, specs: 0.4, brand: 0.3 })
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                    className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl"
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Recommendation Preferences</h2>
                                <p className="text-sm text-white/70">Personalize your laptop search</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
                            </div>
                        ) : (
                            <>
                                {error && (
                                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}

                                {/* Keywords */}
                                <section>
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                        <Tag className="w-4 h-4" />
                                        Keywords (specs, features)
                                    </label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={keywordInput}
                                            onChange={e => setKeywordInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                                            placeholder="e.g., thinkpad, 16gb, ssd, rtx"
                                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                        <button
                                            onClick={handleAddKeyword}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {keywords.map(keyword => (
                                            <span
                                                key={keyword}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
                                            >
                                                {keyword}
                                                <button
                                                    onClick={() => handleRemoveKeyword(keyword)}
                                                    className="p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                        {keywords.length === 0 && (
                                            <span className="text-sm text-gray-500">No keywords added</span>
                                        )}
                                    </div>
                                </section>

                                {/* Price Range */}
                                <section>
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                        <Euro className="w-4 h-4" />
                                        Price Range (EUR)
                                    </label>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                value={minPrice ?? ''}
                                                onChange={e => setMinPrice(e.target.value ? Number(e.target.value) : null)}
                                                placeholder="Min"
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <span className="text-gray-400 self-center">to</span>
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                value={maxPrice ?? ''}
                                                onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
                                                placeholder="Max"
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </section>

                                {/* Brands */}
                                <section>
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                        <Building2 className="w-4 h-4" />
                                        Preferred Brands
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {BRAND_OPTIONS.map(brand => (
                                            <button
                                                key={brand}
                                                onClick={() => toggleBrand(brand)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${brands.includes(brand)
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {brand}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                {/* Categories */}
                                <section>
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                        <Settings className="w-4 h-4" />
                                        Laptop Categories
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {CATEGORY_OPTIONS.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => toggleCategory(cat.id)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${categories.includes(cat.id)
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                {cat.emoji} {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                {/* Weight Sliders */}
                                <section>
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                        <Sliders className="w-4 h-4" />
                                        Scoring Weights
                                    </label>
                                    <div className="space-y-4">
                                        {[
                                            { key: 'specs', label: 'Specs/Keywords' },
                                            { key: 'price', label: 'Price Match' },
                                            { key: 'brand', label: 'Brand Preference' },
                                        ].map(({ key, label }) => (
                                            <div key={key} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">{label}</span>
                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                        {Math.round(weights[key as keyof typeof weights] * 100)}%
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={weights[key as keyof typeof weights] * 100}
                                                    onChange={e => setWeights({
                                                        ...weights,
                                                        [key]: Number(e.target.value) / 100
                                                    })}
                                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 flex items-center justify-between gap-4 p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </button>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
                            >
                                {isSaving ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save Preferences
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
