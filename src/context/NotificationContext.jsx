import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { activeProfile } = useProfile();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!activeProfile?.id) return;
    const data = await base44.entities.AppNotification.filter(
      { profile_id: activeProfile.id, is_dismissed: false },
      '-created_date',
      50
    );
    setNotifications(data);
  }, [activeProfile?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => base44.entities.AppNotification.update(n.id, { is_read: true })));
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const dismiss = async (id) => {
    await base44.entities.AppNotification.update(id, { is_dismissed: true });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = async () => {
    await Promise.all(notifications.map(n => base44.entities.AppNotification.update(n.id, { is_dismissed: true })));
    setNotifications([]);
  };

  const addNotification = async (notification) => {
    if (!activeProfile?.id) return;
    const created = await base44.entities.AppNotification.create({
      profile_id: activeProfile.id,
      ...notification,
      is_read: false,
      is_dismissed: false,
    });
    setNotifications(prev => [created, ...prev]);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isOpen,
      setIsOpen,
      markAllRead,
      dismiss,
      clearAll,
      addNotification,
      fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}