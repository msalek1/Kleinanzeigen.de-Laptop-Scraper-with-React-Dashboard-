"""
Server-Sent Events (SSE) support for real-time scraper progress updates.

Provides a thread-safe event queue system for broadcasting scraper progress
to connected clients in real-time.
"""

import json
import queue
import time
from datetime import datetime
from threading import Lock
from typing import Any, Dict, Generator, Optional
from flask import Response


class ScraperProgressManager:
    """
    Manages real-time progress updates for scraper jobs using SSE.
    
    Thread-safe implementation that allows multiple clients to subscribe
    to progress updates from running scraper jobs.
    
    Attributes:
        _subscribers: Dict mapping job_id to list of subscriber queues.
        _lock: Threading lock for thread-safe operations.
        _current_progress: Dict storing latest progress for each job.
    """
    
    def __init__(self):
        self._subscribers: Dict[int, list] = {}
        self._lock = Lock()
        self._current_progress: Dict[int, Dict[str, Any]] = {}
    
    def subscribe(self, job_id: int) -> queue.Queue:
        """
        Subscribe to progress updates for a specific job.
        
        Args:
            job_id: The scraper job ID to subscribe to.
            
        Returns:
            Queue that will receive progress updates.
        """
        q = queue.Queue(maxsize=100)
        with self._lock:
            if job_id not in self._subscribers:
                self._subscribers[job_id] = []
            self._subscribers[job_id].append(q)
            
            # Send current progress immediately if available
            if job_id in self._current_progress:
                q.put(self._current_progress[job_id])
        
        return q
    
    def unsubscribe(self, job_id: int, q: queue.Queue):
        """
        Unsubscribe from progress updates.
        
        Args:
            job_id: The job ID to unsubscribe from.
            q: The queue to remove.
        """
        with self._lock:
            if job_id in self._subscribers:
                try:
                    self._subscribers[job_id].remove(q)
                    if not self._subscribers[job_id]:
                        del self._subscribers[job_id]
                except ValueError:
                    pass
    
    def publish(self, job_id: int, progress: Dict[str, Any]):
        """
        Publish progress update to all subscribers of a job.
        
        Args:
            job_id: The job ID to publish progress for.
            progress: Progress data dict containing:
                - status: Current status (running, completed, failed)
                - current_keyword: Currently scraping keyword
                - keyword_index: Index of current keyword (0-based)
                - total_keywords: Total number of keywords
                - listings_found: Total unique listings found so far
                - elapsed_seconds: Time elapsed since job start
                - message: Human-readable status message
        """
        progress['timestamp'] = datetime.utcnow().isoformat()
        
        with self._lock:
            # Store current progress
            self._current_progress[job_id] = progress
            
            # Broadcast to all subscribers
            if job_id in self._subscribers:
                dead_queues = []
                for q in self._subscribers[job_id]:
                    try:
                        q.put_nowait(progress)
                    except queue.Full:
                        dead_queues.append(q)
                
                # Remove full/dead queues
                for q in dead_queues:
                    self._subscribers[job_id].remove(q)
    
    def complete(self, job_id: int, final_status: Dict[str, Any]):
        """
        Mark a job as complete and notify all subscribers.
        
        Args:
            job_id: The job ID that completed.
            final_status: Final status data to send.
        """
        final_status['timestamp'] = datetime.utcnow().isoformat()
        final_status['completed'] = True
        
        with self._lock:
            self._current_progress[job_id] = final_status
            
            if job_id in self._subscribers:
                for q in self._subscribers[job_id]:
                    try:
                        q.put_nowait(final_status)
                    except queue.Full:
                        pass
    
    def cleanup(self, job_id: int):
        """
        Clean up resources for a completed job.
        
        Args:
            job_id: The job ID to clean up.
        """
        with self._lock:
            if job_id in self._current_progress:
                del self._current_progress[job_id]
            if job_id in self._subscribers:
                del self._subscribers[job_id]


# Global progress manager instance
progress_manager = ScraperProgressManager()


def generate_sse_stream(job_id: int) -> Generator[str, None, None]:
    """
    Generate SSE stream for a scraper job.
    
    Yields SSE-formatted events for progress updates until the job completes
    or the client disconnects.
    
    Args:
        job_id: The job ID to stream progress for.
        
    Yields:
        SSE-formatted event strings.
    """
    q = progress_manager.subscribe(job_id)
    
    try:
        # Send initial connection event
        yield f"event: connected\ndata: {json.dumps({'job_id': job_id})}\n\n"
        
        while True:
            try:
                # Wait for progress update with timeout
                progress = q.get(timeout=30)
                
                # Format as SSE event
                event_type = 'complete' if progress.get('completed') else 'progress'
                yield f"event: {event_type}\ndata: {json.dumps(progress)}\n\n"
                
                # Exit if job completed
                if progress.get('completed'):
                    break
                    
            except queue.Empty:
                # Send keepalive ping
                yield f"event: ping\ndata: {json.dumps({'timestamp': datetime.utcnow().isoformat()})}\n\n"
                
    finally:
        progress_manager.unsubscribe(job_id, q)


def create_sse_response(job_id: int) -> Response:
    """
    Create a Flask Response for SSE streaming.
    
    Args:
        job_id: The job ID to stream progress for.
        
    Returns:
        Flask Response configured for SSE.
    """
    return Response(
        generate_sse_stream(job_id),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',  # Disable nginx buffering
        }
    )
