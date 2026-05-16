import { uploadMembershipReceipt, getMyTransactions } from '../../services/api';
import { FaCloudUploadAlt, FaFileAlt, FaCheckCircle, FaTrashAlt, FaClock, FaTimesCircle } from 'react-icons/fa';

const UploadReceipt = () => {
  const [receipts, setReceipts] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const { data } = await getMyTransactions();
      // Filter only membership transactions that have a receipt
      const membershipReceipts = data
        .filter(t => t.type === 'membership' && t.receipt_url)
        .map(t => ({
          id: t.id,
          name: `Receipt #${t.reference.split('-').pop()}`,
          size: 'N/A',
          date: new Date(t.created_at).toLocaleDateString(),
          status: t.status.charAt(0).toUpperCase() + t.status.slice(1),
          url: t.receipt_url
        }));
      setReceipts(membershipReceipts);
    } catch (err) {
      console.error('Error fetching receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (file) => {
    // Basic validation
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|pdf|doc|docx)$/i)) {
      alert('Invalid file type. Please upload Image, PDF or DOC.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }

    setUploading(true);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append('receipt', file);
      
      setUploadProgress(50);
      await uploadMembershipReceipt(formData);
      setUploadProgress(100);
      
      alert('Receipt uploaded successfully! Admin will verify it shortly.');
      fetchReceipts(); // Refresh the list
    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.response?.data?.message || 'Failed to upload receipt. Please check your connection.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
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
                      <span className={`stmt-status status-${stmt.status.toLowerCase()}`}>
                        {stmt.status === 'Verified' && <FaCheckCircle style={{ color: '#10b981' }} />}
                        {stmt.status === 'Pending' && <FaClock style={{ color: '#f59e0b' }} />}
                        {stmt.status === 'Rejected' && <FaTimesCircle style={{ color: '#ef4444' }} />}
                        {stmt.status}
                      </span>
                      {stmt.status === 'Pending' && (
                        <button className="stmt-delete-btn" onClick={() => handleDelete(stmt.id)}>
                          <FaTrashAlt />
                        </button>
                      )}
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
