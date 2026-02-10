'use client';

import type { EditorStep } from '@/types';

const STEPS: { step: EditorStep; label: string }[] = [
  { step: 1, label: 'Paste' },
  { step: 2, label: 'Edit' },
  { step: 3, label: 'Voice' },
  { step: 4, label: 'Export' },
];

interface StepIndicatorProps {
  currentStep: EditorStep;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-4">
      {STEPS.map(({ step, label }) => (
        <div key={step} className="flex flex-col items-center gap-1">
          <div
            className={`w-10 h-1.5 rounded-full transition-colors ${
              step < currentStep
                ? 'bg-black'
                : step === currentStep
                  ? 'bg-black'
                  : 'bg-gray-200'
            }`}
          />
          <span
            className={`text-xs transition-colors ${
              step <= currentStep ? 'text-gray-700 font-medium' : 'text-gray-400'
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
