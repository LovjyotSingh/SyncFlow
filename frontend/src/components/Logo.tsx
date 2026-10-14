import Image from 'next/image';

const sizes = {
  sm: { mark: 34, word: 'text-[1.35rem]' },
  md: { mark: 46, word: 'text-[1.85rem]' },
  lg: { mark: 64, word: 'text-4xl' },
} as const;

export default function Logo({
  size = 'md',
  wordmark = true,
  className = '',
}: {
  size?: keyof typeof sizes;
  wordmark?: boolean;
  className?: string;
}) {
  const spec = sizes[size];

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <Image
        src="/logo-mark.png"
        alt={wordmark ? '' : 'SyncFlow'}
        width={399}
        height={422}
        unoptimized
        style={{ height: spec.mark, width: 'auto' }}
        className="shrink-0"
        priority={size !== 'sm'}
      />
      {wordmark && (
        <span className={`font-sans leading-none font-bold tracking-tight ${spec.word}`}>
          <span className="text-white">Sync</span>
          <span className="brand-text">Flow</span>
        </span>
      )}
    </span>
  );
}
