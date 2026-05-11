'use client';
import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  deadline: string;
}

export default function CountdownTimer({ deadline }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('00:00:00');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (!deadline) {
      setTimeLeft('--:--:--');
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(deadline).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft('OVERDUE');
        setIsOverdue(true);
        clearInterval(timer);
        return;
      }

      const hours = Math.floor((difference / (1000 * 60 * 60)));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setTimeLeft(formatted);
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  return (
    <div className="flex items-center gap-1.5">
      <span className={`material-symbols-outlined text-sm ${isOverdue ? 'text-red-500 animate-pulse' : 'text-[#fce003]'}`}>
        {isOverdue ? 'warning' : 'timer'}
      </span>
      <span className={`text-[10px] font-mono font-bold tracking-widest ${isOverdue ? 'text-red-500' : 'text-on-surface'}`}>
        {timeLeft}
      </span>
    </div>
  );



}
