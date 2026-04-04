import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import SongCard from '../components/SongCard';

const DOWNLOAD_COOKIE_NAME = 'spot_download_token';
const DOWNLOAD_POLL_INTERVAL_MS = 250;
const DOWNLOAD_TIMEOUT_MS = 20000;
const SCHEDULE_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

function clearCookie(cookieName) {
  document.cookie = `${cookieName}=; Max-Age=0; Path=/`;
}

function createRandomDownloadToken() {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const [todaySongs, setTodaySongs] = useState([]);
  const [isTomorrowDisplay, setIsTomorrowDisplay] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingVideoId, setDownloadingVideoId] = useState(null);
  const downloadPollRef = useRef(null);
  const downloadTimeoutRef = useRef(null);

  const isAdmin = user && (user.role === 'MEMBER' || user.role === 'LEADER');

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'auth_failed') {
      showToast('로그인에 실패했습니다. @dgsw.hs.kr 이메일을 사용해주세요.', 'error');
      setSearchParams({});
    }
  }, [searchParams, showToast, setSearchParams]);

  useEffect(() => {
    Promise.all([
      api.get('/api/songs/today'),
      api.get('/api/songs/schedule'),
    ])
      .then(([todayRes, scheduleRes]) => {
        setTodaySongs(todayRes.data.songs);
        setIsTomorrowDisplay(Boolean(todayRes.data.is_tomorrow));
        setSchedule(scheduleRes.data.songs);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (downloadPollRef.current) {
        clearInterval(downloadPollRef.current);
      }
      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current);
      }
    };
  }, []);

  const readCookie = (cookieName) => {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    const pair = cookies.find((item) => item.startsWith(`${cookieName}=`));
    if (!pair) return null;
    return decodeURIComponent(pair.substring(cookieName.length + 1));
  };

  const stopDownloadTracking = () => {
    if (downloadPollRef.current) {
      clearInterval(downloadPollRef.current);
      downloadPollRef.current = null;
    }
    if (downloadTimeoutRef.current) {
      clearTimeout(downloadTimeoutRef.current);
      downloadTimeoutRef.current = null;
    }
  };

  const handleDownload = (videoId, title) => {
    if (downloadingVideoId) return;

    stopDownloadTracking();
    clearCookie(DOWNLOAD_COOKIE_NAME);

    const downloadToken = createRandomDownloadToken();
    setDownloadingVideoId(videoId);
    showToast('다운로드를 준비 중입니다. 잠시만 기다려주세요.', 'info');

    const url = `${import.meta.env.VITE_API_URL || ''}/api/admin/wakeup/download/${videoId}?downloadToken=${encodeURIComponent(downloadToken)}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    downloadPollRef.current = setInterval(() => {
      const tokenInCookie = readCookie(DOWNLOAD_COOKIE_NAME);
      if (tokenInCookie !== downloadToken) return;

      stopDownloadTracking();
      clearCookie(DOWNLOAD_COOKIE_NAME);
      setDownloadingVideoId(null);
      showToast('다운로드가 시작되었습니다.', 'success');
    }, DOWNLOAD_POLL_INTERVAL_MS);

    downloadTimeoutRef.current = setTimeout(() => {
      stopDownloadTracking();
      clearCookie(DOWNLOAD_COOKIE_NAME);
      setDownloadingVideoId(null);
      showToast('다운로드 시작 신호를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.', 'warning');
    }, DOWNLOAD_TIMEOUT_MS);
  };

  const grouped = useMemo(() => {
    const groupedByDate = {};
    for (const song of schedule) {
      const dateKey = SCHEDULE_DATE_FORMATTER.format(new Date(song.play_date));
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(song);
    }
    return groupedByDate;
  }, [schedule]);

  if (loading) {
    return <div className="flex justify-center py-20 cu-empty">로딩 중...</div>;
  }

  return (
    <div className="cu-page space-y-6 sm:space-y-7">
      <div
        className="flex items-center gap-2.5 px-4 py-3 rounded-xl border"
        style={{
          background: 'var(--dds-color-status-warning-soft)',
          borderColor: 'var(--dds-color-status-warning-border)',
        }}
      >
        <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--dds-color-status-warning)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm" style={{ color: 'var(--dds-color-text-primary)' }}>
          4/5~4/10 DDS 및 DAuth 전환으로 인해 서비스 작동이 원활하지 않을 수 있습니다.
        </p>
      </div>

      <section className="cu-card">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight mb-3">{isTomorrowDisplay ? '내일' : '오늘'}의 기상송</h2>
        {todaySongs.length === 0 ? (
          <p className="cu-empty">{isTomorrowDisplay ? '내일' : '오늘'} 예정된 기상송이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {todaySongs.map(song => (
              <SongCard
                key={song.id}
                song={song}
                showUser
                showDate={false}
                actions={
                  isAdmin && (
                    <button
                      onClick={() => handleDownload(song.video_id, song.title)}
                      disabled={Boolean(downloadingVideoId)}
                      className="cu-btn cu-btn-secondary w-full sm:w-auto disabled:cursor-not-allowed"
                    >
                      {downloadingVideoId === song.video_id
                        ? '잠시만 기다려주세요...'
                        : 'MP3 다운로드'}
                    </button>
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="cu-card">
        <h2 className="text-base sm:text-lg font-semibold tracking-tight mb-3">기상송 일정</h2>
        {Object.keys(grouped).length === 0 ? (
          <p className="cu-empty">예정된 기상송이 없습니다.</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([date, songs]) => (
              <div key={date}>
                <h3 className="text-xs sm:text-sm font-semibold mb-2" style={{ color: 'var(--dds-color-text-secondary)' }}>
                  {date}
                </h3>
                <div className="space-y-3">
                  {songs.map(song => (
                    <SongCard key={song.id} song={song} showUser showDate={false} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
