import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import api from '../api/client';
import { useToast } from '../context/ToastContext';

const TEMPLATES = [
  { value: 'EQUIPMENT', label: '장비 대여 신청' },
  { value: 'EVENT', label: '행사 지원 요청' },
  { value: 'BUDGET', label: '예산 사용 신청' },
  { value: 'GENERAL', label: '일반 품의' },
];

const MARKDOWN_TEMPLATES = {
  EQUIPMENT: `# 장비 대여 신청

## 장비 정보
- **장비명**:
- **대여 시작일**:
- **대여 종료일**:

## 사용 목적
(장비 사용 목적을 입력해주세요)

## 비고
(추가 사항이 있다면 입력해주세요)
`,
  EVENT: `# 행사 지원 요청

## 행사 정보
- **행사명**:
- **일시**:
- **장소**:

## 필요 지원
- **필요 장비**:
- **투입 인원**:

## 상세 내용
(상세 내용을 입력해주세요)

## 비고
(추가 사항이 있다면 입력해주세요)
`,
  BUDGET: `# 예산 사용 신청

## 사용 항목
- **항목명**:
- **금액**: 원
- **구매처**:

## 사용 목적
(예산 사용 목적을 입력해주세요)

## 비고
(추가 사항이 있다면 입력해주세요)
`,
  GENERAL: `# 일반 품의

## 요청 내용
(요청 내용을 자유롭게 입력해주세요)

## 비고
(추가 사항이 있다면 입력해주세요)
`,
};

const MAX_CONTENT_LENGTH = 10000;
const ROLE_LABELS = { LEADER: '부장', MEMBER: '부원' };

export default function ApprovalNew() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [template, setTemplate] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // 결재선
  const [approver, setApprover] = useState(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const handleTemplateChange = (value) => {
    setTemplate(value);
    setContent(MARKDOWN_TEMPLATES[value] || '');
  };

  // 결재선 검색
  const searchMembers = useCallback(async (q) => {
    try {
      const res = await api.get('/api/approval/members', { params: { q } });
      setMemberResults(res.data.members || []);
      setShowDropdown(true);
    } catch {
      setMemberResults([]);
    }
  }, []);

  useEffect(() => {
    if (memberQuery.trim().length === 0) {
      searchMembers('');
      return;
    }
    const timer = setTimeout(() => searchMembers(memberQuery), 300);
    return () => clearTimeout(timer);
  }, [memberQuery, searchMembers]);

  // 드롭다운 바깥 클릭 닫기
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectApprover = (member) => {
    setApprover(member);
    setMemberQuery('');
    setShowDropdown(false);
  };

  // 파일 처리
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length + files.length > 3) {
      showToast('첨부 파일은 최대 3개까지 가능합니다.', 'error');
      e.target.value = '';
      return;
    }
    const oversized = selected.filter((f) => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      showToast('파일 크기는 5MB 이하여야 합니다.', 'error');
      e.target.value = '';
      return;
    }
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 상신
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!template || !title.trim() || !content.trim()) {
      showToast('양식, 제목, 내용을 모두 입력해주세요.', 'error');
      return;
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      showToast(`내용은 ${MAX_CONTENT_LENGTH}자 이하여야 합니다.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('template', template);
      formData.append('title', title.trim());
      formData.append('content', content);
      if (approver) {
        formData.append('approver_id', approver.id);
      }
      for (const file of files) {
        formData.append('attachments', file);
      }
      await api.post('/api/approval', formData);
      showToast('결재 문서가 상신되었습니다.', 'success');
      navigate('/approvals');
    } catch (err) {
      showToast(err.response?.data?.error || '상신에 실패했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cu-page max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/approvals')} className="cu-btn cu-btn-muted !px-2">
          &larr;
        </button>
        <h2 className="cu-title !mb-0">결재 기안 작성</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 양식 선택 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            결재 양식 <span style={{ color: 'var(--dds-color-status-error)' }}>*</span>
          </label>
          <select
            value={template}
            onChange={(e) => handleTemplateChange(e.target.value)}
            required
            className="cu-input"
          >
            <option value="">양식을 선택해주세요</option>
            {TEMPLATES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium mb-1">
            제목 <span style={{ color: 'var(--dds-color-status-error)' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            placeholder="결재 문서 제목을 입력해주세요"
            className="cu-input"
          />
        </div>

        {/* 결재선 */}
        <div>
          <label className="block text-sm font-medium mb-1">결재선</label>
          {approver ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
                style={{ background: 'var(--dds-color-bg-assistive)', color: 'var(--dds-color-text-normal)' }}
              >
                {approver.name}
                <span className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>
                  ({ROLE_LABELS[approver.role] || approver.role})
                </span>
                <button
                  type="button"
                  onClick={() => setApprover(null)}
                  className="ml-1 hover:opacity-70"
                  style={{ color: 'var(--dds-color-text-secondary)' }}
                >
                  &times;
                </button>
              </span>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <input
                type="text"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                onFocus={() => { searchMembers(memberQuery); setShowDropdown(true); }}
                placeholder="이름 또는 도담ID로 검색..."
                className="cu-input"
              />
              {showDropdown && memberResults.length > 0 && (
                <ul
                  className="absolute z-50 w-full mt-1 rounded-lg shadow-lg overflow-y-auto max-h-48 border bg-white"
                  style={{ borderColor: 'var(--dds-color-border-normal)' }}
                >
                  {memberResults.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => selectApprover(m)}
                        className="w-full text-left px-3 py-2 text-sm hover:opacity-80 flex items-center justify-between"
                        style={{ background: 'var(--dds-color-bg-normal)' }}
                      >
                        <span>{m.name}</span>
                        <span className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>
                          {m.username} &middot; {ROLE_LABELS[m.role] || m.role}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {showDropdown && memberResults.length === 0 && memberQuery.trim() && (
                <div
                  className="absolute z-10 w-full mt-1 rounded-lg shadow-lg p-3 text-sm border"
                  style={{ background: 'var(--dds-color-bg-normal)', borderColor: 'var(--dds-color-border-normal)', color: 'var(--dds-color-text-secondary)' }}
                >
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          )}
          <p className="mt-1 text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>
            방송부 구성원 중 결재자를 지정할 수 있습니다.
          </p>
        </div>

        {/* 마크다운 에디터 */}
        {template && (
          <div data-color-mode="light">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">
                내용 <span style={{ color: 'var(--dds-color-status-error)' }}>*</span>
              </label>
              <span className="text-xs" style={{ color: content.length > MAX_CONTENT_LENGTH ? 'var(--dds-color-status-error)' : 'var(--dds-color-text-secondary)' }}>
                {content.length} / {MAX_CONTENT_LENGTH}
              </span>
            </div>
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || '')}
              height={400}
              preview="live"
            />
          </div>
        )}

        {/* 첨부 파일 */}
        {template && (
          <div>
            <label className="block text-sm font-medium mb-1">
              첨부 파일{' '}
              <span className="text-xs font-normal" style={{ color: 'var(--dds-color-text-secondary)' }}>
                (최대 3개, 각 5MB 이하 / JPEG·PNG·GIF·WEBP·PDF)
              </span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 3}
              className="cu-btn cu-btn-muted disabled:opacity-50"
            >
              파일 선택
            </button>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate" style={{ color: 'var(--dds-color-text-secondary)' }}>{f.name}</span>
                    <span className="text-xs shrink-0" style={{ color: 'var(--dds-color-text-secondary)' }}>
                      {(f.size / 1024).toFixed(0)}KB
                    </span>
                    <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-xs cu-btn cu-btn-danger !py-0.5 !px-2">
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4">
          <button
            type="submit"
            disabled={!template || !title.trim() || !content.trim() || content.length > MAX_CONTENT_LENGTH || submitting}
            className="cu-btn cu-btn-primary flex-1 disabled:opacity-50"
          >
            {submitting ? '상신 중...' : '상신'}
          </button>
          <button type="button" onClick={() => navigate('/approvals')} className="cu-btn cu-btn-muted flex-1">
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
