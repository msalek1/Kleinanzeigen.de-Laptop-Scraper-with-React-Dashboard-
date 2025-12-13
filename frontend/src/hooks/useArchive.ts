/**
 * useArchive Hook
 * 
 * Manages archived listings with server-side sync using a shareable sync code.
 * Enables cross-device synchronization of "viewed" listings.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { archiveApi, getSyncCode, setSyncCode } from '../services/api'

interface UseArchiveReturn {
    /** Set of archived listing IDs */
    archivedIds: Set<number>
    /** Whether a listing is archived */
    isArchived: (listingId: number) => boolean
    /** Toggle archive status of a listing */
    toggleArchive: (listingId: number) => Promise<void>
    /** Archive a listing */
    archive: (listingId: number) => Promise<void>
    /** Unarchive a listing */
    unarchive: (listingId: number) => Promise<void>
    /** Clear all archived listings */
    clearAll: () => Promise<void>
    /** The current sync code */
    syncCode: string | null
    /** Set a new sync code (for importing from another device) */
    importSyncCode: (code: string) => Promise<void>
    /** Generate a new sync code */
    generateNewCode: () => Promise<string>
    /** Whether archive data is loading */
    isLoading: boolean
    /** Error message if any */
    error: string | null
}

/**
 * Hook for managing archived listings with cross-device sync.
 * 
 * Usage:
 * ```tsx
 * const { isArchived, toggleArchive, syncCode } = useArchive()
 * 
 * // Check if archived
 * if (isArchived(123)) { ... }
 * 
 * // Toggle archive
 * <button onClick={() => toggleArchive(listing.id)}>
 *   {isArchived(listing.id) ? 'Unarchive' : 'Archive'}
 * </button>
 * 
 * // Share sync code
 * <p>Sync Code: {syncCode}</p>
 * ```
 */
export function useArchive(): UseArchiveReturn {
    const [archivedIds, setArchivedIds] = useState<Set<number>>(new Set())
    const [syncCode, setSyncCodeState] = useState<string | null>(getSyncCode())
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const initialLoadDone = useRef(false)

    // Initialize: get or create sync code and load archived IDs
    useEffect(() => {
        if (initialLoadDone.current) return
        initialLoadDone.current = true

        const initArchive = async () => {
            setIsLoading(true)
            setError(null)

            try {
                let code = getSyncCode()

                // If no sync code, generate one
                if (!code) {
                    const response = await archiveApi.generateSyncCode()
                    code = response.data.sync_code
                    setSyncCode(code)
                }

                setSyncCodeState(code)

                // Load archived listings
                const archiveResponse = await archiveApi.getArchived()
                setArchivedIds(new Set(archiveResponse.data.listing_ids))
            } catch (err) {
                console.error('Failed to initialize archive:', err)
                setError('Failed to load archive data')
            } finally {
                setIsLoading(false)
            }
        }

        initArchive()
    }, [])

    const isArchived = useCallback((listingId: number): boolean => {
        return archivedIds.has(listingId)
    }, [archivedIds])

    const archive = useCallback(async (listingId: number): Promise<void> => {
        if (!syncCode) return

        try {
            await archiveApi.archiveListing(listingId)
            setArchivedIds(prev => new Set([...prev, listingId]))
        } catch (err) {
            console.error('Failed to archive listing:', err)
            throw err
        }
    }, [syncCode])

    const unarchive = useCallback(async (listingId: number): Promise<void> => {
        if (!syncCode) return

        try {
            await archiveApi.unarchiveListing(listingId)
            setArchivedIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(listingId)
                return newSet
            })
        } catch (err) {
            console.error('Failed to unarchive listing:', err)
            throw err
        }
    }, [syncCode])

    const toggleArchive = useCallback(async (listingId: number): Promise<void> => {
        if (isArchived(listingId)) {
            await unarchive(listingId)
        } else {
            await archive(listingId)
        }
    }, [isArchived, archive, unarchive])

    const clearAll = useCallback(async (): Promise<void> => {
        if (!syncCode) return

        try {
            await archiveApi.clearArchive()
            setArchivedIds(new Set())
        } catch (err) {
            console.error('Failed to clear archive:', err)
            throw err
        }
    }, [syncCode])

    const importSyncCode = useCallback(async (code: string): Promise<void> => {
        setIsLoading(true)
        setError(null)

        try {
            // Set new sync code
            setSyncCode(code)
            setSyncCodeState(code)

            // Load archived listings for this code
            const archiveResponse = await archiveApi.getArchived()
            setArchivedIds(new Set(archiveResponse.data.listing_ids))
        } catch (err) {
            console.error('Failed to import sync code:', err)
            setError('Invalid sync code or failed to load data')
            throw err
        } finally {
            setIsLoading(false)
        }
    }, [])

    const generateNewCode = useCallback(async (): Promise<string> => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await archiveApi.generateSyncCode()
            const newCode = response.data.sync_code

            setSyncCode(newCode)
            setSyncCodeState(newCode)
            setArchivedIds(new Set()) // New code = empty archive

            return newCode
        } catch (err) {
            console.error('Failed to generate new sync code:', err)
            setError('Failed to generate new sync code')
            throw err
        } finally {
            setIsLoading(false)
        }
    }, [])

    return {
        archivedIds,
        isArchived,
        toggleArchive,
        archive,
        unarchive,
        clearAll,
        syncCode,
        importSyncCode,
        generateNewCode,
        isLoading,
        error,
    }
}

export default useArchive
