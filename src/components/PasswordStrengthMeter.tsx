// PasswordStrengthMeter — live strength bar + percent + label + feedback
// Pure UI: scorePassword() se aata hai, password kahin log/store nahi hota.
import { useMemo } from 'react';
import { scorePassword } from '@/utils/passwordStrength';

interface Props {
  password: string;
  /** Field ke turant niche render karo (mb-1 spacing) */
  className?: string;
}

const SEGMENTS = 4;

export function PasswordStrengthMeter({ password, className = '' }: Props) {
  // useMemo: har keystroke pe pure calculation, koi side-effect nahi
  const strength = useMemo(() => scorePassword(password), [password]);

  if (!password) return null;

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Segmented bar (jaise password managers me hota hai) */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1 h-1.5">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors duration-200 ${
                i < strength.score ? strength.barColor : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className={`text-[11px] font-bold tabular-nums shrink-0 ${strength.textColor}`}>
          {strength.percent}% · {strength.label}
        </span>
      </div>

      {/* Feedback (sirf jab policy meet na ho ya koi issue ho) */}
      {strength.feedback.length > 0 && (
        <ul className="text-[11px] text-gray-500 leading-snug list-none space-y-0.5">
          {strength.feedback.slice(0, 3).map((f, i) => (
            <li key={i}>• {f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
