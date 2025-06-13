import React from 'react';
import { cn } from '@/lib/utils';

interface PinInputDisplayProps {
  length: number;
  filledCount: number;
}

const PinInputDisplay: React.FC<PinInputDisplayProps> = ({ length, filledCount }) => {
  return (
    <div className="flex justify-center items-center gap-3 h-8">
      {Array.from({ length }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'w-5 h-5 rounded-full transition-all duration-200',
            index < filledCount ? 'bg-primary scale-110' : 'bg-gray-200'
          )}
        />
      ))}
    </div>
  );
};

export default PinInputDisplay;