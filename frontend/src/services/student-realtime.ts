/**
 * Unified Student Realtime Client
 * 
 * Manages EXACTLY ONE EventSource connection to /api/student/events across the entire
 * Student Portal session. Routes domain events (complaints, leaves, notifications,
 * biometrics, rooms, mess, outings) to typed component subscribers without duplicating
 * network sockets or exhausting browser HTTP/1.1 connection pools.
 */

const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem('hms_student_auth_token') || localStorage.getItem('token');
  } catch {
    return null;
  }
};

export type StudentEventDomain =
  | 'complaint'
  | 'leave'
  | 'notification'
  | 'biometric'
  | 'room'
  | 'mess'
  | 'outing'
  | 'all';

export type StudentEventHandler = (event: any) => void;

class StudentRealtimeClient {
  private eventSource: EventSource | null = null;
  private subscribers: Map<StudentEventDomain, Set<StudentEventHandler>> = new Map();
  private reconnectListeners: Set<() => void> = new Set();
  private reconnectTimeout: any = null;
  private isExplicitlyClosed = false;
  private currentToken: string | null = null;

  constructor() {
    // Initialize subscriber sets for each domain
    const domains: StudentEventDomain[] = [
      'complaint',
      'leave',
      'notification',
      'biometric',
      'room',
      'mess',
      'outing',
      'all',
    ];
    for (const domain of domains) {
      this.subscribers.set(domain, new Set());
    }
  }

  /**
   * Total number of active subscribers across all domains
   */
  private getTotalSubscribersCount(): number {
    let count = 0;
    for (const set of this.subscribers.values()) {
      count += set.size;
    }
    return count;
  }

  /**
   * Ensure a single shared EventSource connection is active
   */
  public connect(): void {
    const token = getStoredToken();
    if (!token) {
      return;
    }

    // If already connected with the same token, do not re-create
    if (this.eventSource && this.currentToken === token && this.eventSource.readyState !== EventSource.CLOSED) {
      return;
    }

    // If token changed or previous connection closed, reset
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isExplicitlyClosed = false;
    this.currentToken = token;

    try {
      const url = `/api/student/events?token=${encodeURIComponent(token)}`;
      this.eventSource = new EventSource(url);

      // Connected handshake
      this.eventSource.addEventListener('connected', () => {
        // Notify reconnect listeners to perform authoritative REST state sync
        for (const listener of this.reconnectListeners) {
          try {
            listener();
          } catch (err) {
            console.error('[StudentRealtime] Error in reconnect listener:', err);
          }
        }
      });

      // Domain-specific event listeners
      this.setupDomainListener('complaint_event', 'complaint');
      this.setupDomainListener('leave_event', 'leave');
      this.setupDomainListener('notification_event', 'notification');
      this.setupDomainListener('biometric_event', 'biometric');
      this.setupDomainListener('room_event', 'room');
      this.setupDomainListener('mess_event', 'mess');
      this.setupDomainListener('outing_event', 'outing');

      // Generic multiplexed student_event listener
      this.eventSource.addEventListener('student_event', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          const domain = (parsed.domain || '').toLowerCase() as StudentEventDomain;
          const payload = parsed.payload || parsed;

          // Dispatch to domain subscribers if not already dispatched by named event
          this.dispatchToSubscribers(domain, payload);
          this.dispatchToSubscribers('all', parsed);
        } catch (err) {
          console.error('[StudentRealtime] Error parsing student_event data:', err);
        }
      });

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Auto-reconnect after backoff if not explicitly disconnected and still has subscribers
        if (!this.isExplicitlyClosed && this.getTotalSubscribersCount() > 0) {
          if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('[StudentRealtime] Failed to initialize EventSource:', err);
      if (!this.isExplicitlyClosed && this.getTotalSubscribersCount() > 0) {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, 5000);
      }
    }
  }

  /**
   * Helper to attach event listener for named domain event
   */
  private setupDomainListener(eventName: string, domain: StudentEventDomain): void {
    if (!this.eventSource) return;

    this.eventSource.addEventListener(eventName, (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        this.dispatchToSubscribers(domain, parsed);
        this.dispatchToSubscribers('all', { domain: domain.toUpperCase(), ...parsed });
      } catch (err) {
        console.error(`[StudentRealtime] Error parsing ${eventName} data:`, err);
      }
    });
  }

  /**
   * Dispatches event to registered handlers
   */
  private dispatchToSubscribers(domain: StudentEventDomain, data: any): void {
    const handlers = this.subscribers.get(domain);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[StudentRealtime] Handler error for ${domain}:`, err);
        }
      }
    }
  }

  /**
   * Subscribe to a specific domain event stream.
   * Lazily connects the single EventSource on first subscriber.
   * Returns an unsubscribe function.
   */
  public subscribe(domain: StudentEventDomain, handler: StudentEventHandler): () => void {
    const set = this.subscribers.get(domain);
    if (set) {
      set.add(handler);
    }

    // Ensure connection is established
    this.connect();

    return () => {
      if (set) {
        set.delete(handler);
      }

      // If zero subscribers remain across all domains, tear down connection cleanly
      if (this.getTotalSubscribersCount() === 0) {
        this.disconnect();
      }
    };
  }

  /**
   * Register a callback triggered when connection or reconnection is established
   */
  public onReconnect(listener: () => void): () => void {
    this.reconnectListeners.add(listener);
    return () => {
      this.reconnectListeners.delete(listener);
    };
  }

  /**
   * Explicitly disconnects and tears down the SSE connection (e.g. upon user logout)
   */
  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.currentToken = null;
  }
}

export const studentRealtimeClient = new StudentRealtimeClient();
