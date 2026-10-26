import React, { useState, useEffect } from 'react';

const PromptModal = ({ isOpen, title, message, defaultValue = '', onConfirm, onCancel, confirmText = 'Submit', cancelText = 'Cancel' }) => {
  const [inputValue, setInputValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(inputValue);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '400px', animation: 'slideIn 0.3s ease-out' }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
            {message}
          </div>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <input 
              type="text" 
              className="form-input w-full" 
              value={inputValue} 
              onChange={e => setInputValue(e.target.value)} 
              autoFocus
            />
          </div>
          <div className="modal-actions" style={{ marginTop: '0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>{cancelText}</button>
            <button type="submit" className="btn btn-primary">{confirmText}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromptModal;
