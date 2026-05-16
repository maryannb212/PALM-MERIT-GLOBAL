import React, { useState, useRef } from 'react';

import './Dashboard.css';
import { FaCloudUploadAlt, FaFileAlt, FaCheckCircle, FaTrashAlt } from 'react-icons/fa';

const UploadReceipt = () => {
  const [receipts, setReceipts] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = (file) => {
    // Basic validation
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|pdf|doc|docx)$/i)) {
      alert('Invalid file type. Please upload Image, PDF or DOC.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert('File size exceeds 20MB limit.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          const newReceipt = {
            id: Date.now(),
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            date: new Date().toLocaleDateString(),
            status: 'Verified'
          };
          setReceipts((prevList) => [newReceipt, ...prevList]);
          return 0;
        }
        return prev + 20;
      });
    }, 400);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleDelete = (id) => {
    setReceipts(receipts.filter(s => s.id !== id));
  };

  return (
    <>
        <header className="dashboard-header" style={{ marginBottom: '20px' }}>
          <h2>Receipt Upload</h2>
          <p style={{ color: '#64748b' }}>Secure Payment Verification Portal</p>
        </header>

        <div className="upload-receipt-container">
          
          <div className="upload-card">
            <h3>Upload New Receipt</h3>
            
            <div 
              className={`drop-zone ${isDragging ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                accept="image/*,.pdf,.doc,.docx"
              />
              
              {!uploading ? (
                <>
                  <div className="cloud-icon"><FaCloudUploadAlt /></div>
                  <h4>Drop your payment receipt here or click to browse</h4>
                  <p className="file-limits">JPG, PNG, PDF, DOC • Max 20MB</p>
                </>
              ) : (
                <div className="upload-progress-container">
                  <div className="cloud-icon uploading-icon"><FaCloudUploadAlt /></div>
                  <h4>Uploading your receipt...</h4>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <p>{uploadProgress}%</p>
                </div>
              )}
            </div>
          </div>

          <div className="receipts-list-card">
            <h3>Recent Uploads</h3>
            
            {receipts.length === 0 ? (
              <div className="empty-receipts">
                <FaFileAlt className="empty-file-icon" />
                <p>No receipts uploaded yet</p>
              </div>
            ) : (
              <div className="receipts-list">
                {receipts.map((stmt) => (
                  <div key={stmt.id} className="receipt-item">
                    <div className="stmt-info">
                      <FaFileAlt className="stmt-icon" />
                      <div>
                        <h4>{stmt.name}</h4>
                        <p>{stmt.size} • Uploaded on {stmt.date}</p>
                      </div>
                    </div>
                    <div className="stmt-actions">
                      <span className="stmt-status"><FaCheckCircle /> {stmt.status}</span>
                      <button className="stmt-delete-btn" onClick={() => handleDelete(stmt.id)}>
                        <FaTrashAlt />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
    </>
  );
};

export default UploadReceipt;
