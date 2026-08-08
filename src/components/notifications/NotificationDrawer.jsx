import React from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, TrendingUp, TrendingDown, Target, CheckCircle, DollarSign, AlertTriangle, Trophy, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/context/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const TYPE_CONFIG = {
  nightly_balance: { icon: Bell, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  all_time_high:   { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  big_drop:        { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
  goal_off_track:  { icon: Target, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  goal_on_track:   { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
  new_contribution:{ icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
  milestone:       { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  fund_drop:       { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-400/10' },
  near_goal_date:  { icon: Target, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  ytd_gain:        { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10' },
};

function NotificationItem({ notification, onDismiss }) {
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.nightly_balance;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`flex gap-3 p-3 rounded-xl border transition-colors ${
        notification.is_read ? 'bg-card border-border' : 'bg-card border-primary/30'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight">{notification.title}</p>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{notification.message}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
        </p>
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0 mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export default function NotificationDrawer() {
  const { notifications, isOpen, setIsOpen, markAllRead, clearAll, dismiss, unreadCount } = useNotifications();

  return createPortal(
    <AnimatePresence>
      {isOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 h-full w-full max-w-sm z-50 bg-background border-l border-border flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="flex gap-2 px-4 py-2 border-b border-border">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={markAllRead}>
              <CheckCheck className="w-3 h-3" /> Mark all read
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-destructive hover:text-destructive" onClick={clearAll}>
              <Trash2 className="w-3 h-3" /> Clear all
            </Button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <Bell className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60">Balance updates and alerts will appear here</p>
            </div>
          ) : (
            <AnimatePresence>
              {notifications.map(n => (
                <NotificationItem key={n.id} notification={n} onDismiss={dismiss} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </>
      )}
    </AnimatePresence>,
    document.body
  );
}