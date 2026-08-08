import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/context/NotificationContext';
import NotificationDrawer from './NotificationDrawer';

export default function NotificationBell() {
  const { unreadCount, isOpen, setIsOpen } = useNotifications();

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => setIsOpen(true)}
        >
          <Bell className="w-5 h-5" />
        </Button>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 pointer-events-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>
      <NotificationDrawer />
    </>
  );
}