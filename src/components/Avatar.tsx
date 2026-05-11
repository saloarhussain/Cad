"use client";
import React, { useState } from 'react';
import md5 from 'md5';

interface AvatarProps {
  email?: string;
  name?: string;
  size?: number;
  className?: string;
  /** Show a ring on hover */
  ring?: boolean;
}

/**
 * Smart Avatar component:
 * 1. Tries Gravatar (uses email MD5 hash) — shows real photo if person has a Gravatar account.
 * 2. Falls back to UI Avatars (branded initials avatar) if Gravatar has no image.
 */
export default function Avatar({ email, name, size = 64, className = '', ring = false }: AvatarProps) {
  const [src, setSrc] = useState(() => buildGravatarUrl(email, size));
  const fallback = buildUiAvatarUrl(name || email || '?', size);

  const handleError = () => {
    // If Gravatar returned 404, switch to branded initials avatar
    setSrc(fallback);
  };

  return (
    <img
      src={src}
      alt={name || email || 'Avatar'}
      width={size}
      height={size}
      onError={handleError}
      className={`rounded-full object-cover bg-surface-container-highest ${ring ? 'ring-2 ring-yellow-400/30 hover:ring-yellow-400 transition-all' : ''} ${className}`}
    />
  );
}

/** Build Gravatar URL with d=404 so onError fires if no image exists */
function buildGravatarUrl(email?: string, size = 64): string {
  if (!email) return buildUiAvatarUrl('?', size);
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}

/** UI Avatars fallback — branded initials in gold/dark */
function buildUiAvatarUrl(nameOrEmail: string, size = 64): string {
  const displayName = nameOrEmail.includes('@')
    ? nameOrEmail.split('@')[0]
    : nameOrEmail;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&size=${size}&background=1a1a17&color=fce003&bold=true&format=png`;
}
