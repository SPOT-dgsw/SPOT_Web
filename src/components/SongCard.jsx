import { memo } from 'react';

// DateTimeFormat은 매 호출마다 객체 생성 비용이 있으므로 모듈 스코프에서 1회 생성
const PLAY_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

function SongCard({ song, showUser, actions, showDate = true }) {
  return (
    <div className="cu-card flex flex-col sm:flex-row gap-3 sm:gap-4">
      <img
        src={`https://img.youtube.com/vi/${song.video_id}/mqdefault.jpg`}
        alt={song.title}
        loading="lazy"
        decoding="async"
        className="w-full h-28 sm:w-32 sm:h-20 rounded-lg object-cover flex-shrink-0 border"
        style={{ borderColor: 'var(--dds-color-border-normal)' }}
      />
      <div className="flex-1 min-w-0">
        <a
          href={song.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-sm hover:underline line-clamp-2 sm:line-clamp-1"
        >
          {song.title}
        </a>
        <p className="text-xs mt-0.5" style={{ color: 'var(--dds-color-text-secondary)' }}>{song.channel_name}</p>
        {showUser && song.user && (
          <p className="text-xs mt-1" style={{ color: 'var(--dds-color-text-secondary)' }}>{song.user.name}</p>
        )}
        {showDate && song.play_date && (
          <p className="text-xs mt-1" style={{ color: 'var(--dds-color-text-secondary)' }}>
            {PLAY_DATE_FORMATTER.format(new Date(song.play_date))}
          </p>
        )}
      </div>
      {actions && (
        <div className="w-full sm:w-auto flex items-center justify-end sm:justify-start gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default memo(SongCard);
