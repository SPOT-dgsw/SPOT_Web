import { useRef, useState } from 'react';

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

export default function ApprovalForm({ onSubmit, onCancel, loading }) {
  const [template, setTemplate] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleTemplateChange = (value) => {
    setTemplate(value);
    setContent(MARKDOWN_TEMPLATES[value] || '');
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length + files.length > 3) {
      alert('첨부 파일은 최대 3개까지 가능합니다.');
      e.target.value = '';
      return;
    }
    const oversized = selected.filter((f) => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      e.target.value = '';
      return;
    }
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }
    const formData = new FormData();
    formData.append('template', template);
    formData.append('title', title.trim());
    formData.append('content', content);
    for (const file of files) {
      formData.append('attachments', file);
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 양식 선택 */}
      <div>
        <label className="block text-sm font-medium mb-1">결재 양식 <span style={{ color: 'var(--dds-color-status-error)' }}>*</span></label>
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
        <label className="block text-sm font-medium mb-1">제목 <span style={{ color: 'var(--dds-color-status-error)' }}>*</span></label>
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

      {/* 마크다운 편집기 */}
      {template && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">
              내용 <span style={{ color: 'var(--dds-color-status-error)' }}>*</span>
            </label>
            <span className="text-xs" style={{ color: content.length > MAX_CONTENT_LENGTH ? 'var(--dds-color-status-error)' : 'var(--dds-color-text-secondary)' }}>
              {content.length} / {MAX_CONTENT_LENGTH}
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={16}
            className="cu-input resize-y font-mono text-sm"
            style={{ minHeight: '300px' }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const { selectionStart, selectionEnd } = e.target;
                const next = content.slice(0, selectionStart) + '  ' + content.slice(selectionEnd);
                setContent(next);
                requestAnimationFrame(() => {
                  e.target.selectionStart = e.target.selectionEnd = selectionStart + 2;
                });
              }
            }}
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>
            마크다운 문법을 사용할 수 있습니다. (# 제목, **굵게**, - 목록)
          </p>
        </div>
      )}

      {/* 첨부 파일 */}
      {template && (
        <div>
          <label className="block text-sm font-medium mb-1">
            첨부 파일 <span className="text-xs font-normal" style={{ color: 'var(--dds-color-text-secondary)' }}>(최대 3개, 각 5MB 이하 / JPEG·PNG·GIF·WEBP·PDF)</span>
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
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <button
          type="submit"
          disabled={!template || !title.trim() || !content.trim() || content.length > MAX_CONTENT_LENGTH || loading}
          className="cu-btn cu-btn-primary flex-1 disabled:opacity-50"
        >
          {loading ? '제출 중...' : '결재 제출'}
        </button>
        <button type="button" onClick={onCancel} className="cu-btn cu-btn-muted flex-1">
          취소
        </button>
      </div>
    </form>
  );
}
