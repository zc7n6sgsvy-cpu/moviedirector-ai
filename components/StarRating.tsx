'use client';

import React from 'react';

type StarRatingProps = {
  value: number;
  onChange?: (score: number) => void;
  size?: 'sm' | 'md';
  readonly?: boolean;
};

export default function StarRating({ value, onChange, size = 'md', readonly = false }: StarRatingProps) {
  const starSize = size === 'sm' ? 'text-base' : 'text-2xl';

  return (
    <div className={`flex items-center gap-0.5 ${starSize}`} role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly || !onChange}
          onClick={() => onChange?.(star)}
          className={`transition-colors ${readonly || !onChange ? 'cursor-default' : 'cursor-pointer hover:scale-110'} ${
            star <= Math.round(value) ? 'text-[var(--gold)]' : 'text-white/20'
          }`}
          aria-label={`Rate ${star} stars`}
        >
          ★
        </button>
      ))}
      {value > 0 && (
        <span className={`ml-2 text-white/60 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}