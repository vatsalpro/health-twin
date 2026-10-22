import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Pill,
  Calendar,
  Clock,
  ShieldAlert,
  MessageSquare,
  Check,
  ExternalLink,
  X,
} from 'lucide-react';
import { api, AppNotification } from '../api/client';

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [criticalCount, setCriticalCount] = useState<number>(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Poll for unread count every 20 seconds
  const fetchCounts = async () => {
    try {
      const data = await api.getUnreadNotificationCount();
      setUnreadCount(data.unread_count);
      setCriticalCount(data.critical_unread);
    } catch {
      // Silently ignore if not logged in
    }
  };

  const fetchList = async () => {
    try {
      setLoading(true);
      const list = await api.getNotifications(30, filter === 'unread');
      setNotifications(list);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchList();
    }
  }, [isOpen, filter]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      setCriticalCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      try {
        await api.markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {}
    }
    setIsOpen(false);

    if (notif.action_url) {
      navigate(notif.action_url);
    } else if (notif.category === 'MEDICATION_REMINDER' || notif.category === 'MISSED_DOSE_ALERT') {
      navigate('/medications');
    } else if (notif.category === 'APPOINTMENT_UPDATE') {
      navigate('/appointments');
    } else if (notif.category === 'EMERGENCY_ALERT') {
      navigate('/clinician/review-queue');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'MEDICATION_REMINDER':
        return <Pill className="w-4 h-4 text-purple-600" />;
      case 'MISSED_DOSE_ALERT':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'APPOINTMENT_UPDATE':
        return <Calendar className="w-4 h-4 text-teal-600" />;
      case 'EMERGENCY_ALERT':
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      case 'CLINICIAN_MESSAGE':
        return <MessageSquare className="w-4 h-4 text-indigo-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    try {
      const diffMs = Date.now() - new Date(isoDate).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl text-slate-600 hover:text-purple-700 bg-white/60 hover:bg-white/80 border border-purple-200/80 backdrop-blur-md transition-all shadow-2xs hover:scale-105 active:scale-95 ${
          isOpen ? 'ring-2 ring-purple-500 bg-purple-50' : ''
        }`}
        title="Notifications & Medication Reminders"
        aria-label="Open notifications"
      >
        <Bell
          className={`w-5 h-5 text-purple-700 ${
            unreadCount > 0 ? 'animate-bell-shake text-purple-600' : ''
          }`}
        />

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-black tracking-tight text-white shadow-xs ${
              criticalCount > 0 ? 'bg-red-600 animate-pulse' : 'bg-purple-600'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl bg-white/95 backdrop-blur-2xl border border-purple-200/90 shadow-[0_20px_50px_rgba(124,58,237,0.18)] z-50 overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-purple-50/70 border-b border-purple-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-700" />
              <h3 className="font-bold text-sm text-purple-950">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-200 text-purple-900">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 hover:underline transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-3 pt-2 pb-1 bg-white flex items-center gap-2 border-b border-slate-100">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filter === 'all'
                  ? 'bg-purple-100 text-purple-900'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filter === 'unread'
                  ? 'bg-purple-100 text-purple-900'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Unread only ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-purple-50">
            {loading ? (
              <div className="py-10 text-center text-slate-400">
                <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No notifications matching your filter.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer hover:bg-purple-50/60 ${
                    !notif.is_read
                      ? 'bg-purple-50/30 font-medium'
                      : 'bg-white opacity-85'
                  }`}
                >
                  {/* Category icon */}
                  <div
                    className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      notif.priority === 'CRITICAL_EMERGENCY'
                        ? 'bg-red-100 text-red-600 animate-pulse'
                        : notif.category === 'MEDICATION_REMINDER'
                        ? 'bg-purple-100 text-purple-700'
                        : notif.category === 'MISSED_DOSE_ALERT'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {getCategoryIcon(notif.category)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs truncate ${
                          !notif.is_read ? 'font-bold text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {formatTimeAgo(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    {notif.action_url && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-purple-700 hover:text-purple-900">
                        <span>View details</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Mark as read tick */}
                  {!notif.is_read && (
                    <button
                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                      title="Mark as read"
                      className="shrink-0 p-1 rounded-md text-slate-400 hover:text-purple-700 hover:bg-purple-100 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 text-center">
            <span className="text-[10px] text-slate-400">
              PregTwin Clinical Alert & Medication Sync
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
