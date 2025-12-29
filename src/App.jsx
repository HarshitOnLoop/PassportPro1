import React, { useState, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { removeBackground, preload } from '@imgly/background-removal';
import { getCroppedImg, generatePrintSheet, resizeImage } from './canvasUtils';
import { saveAs } from 'file-saver';
import { 
  Printer, Image as ImageIcon, Download, Sparkles, 
  RotateCw, Plus, Trash2, Users, Minus, CheckCircle, UserPlus 
} from 'lucide-react';
import './App.css';

const TEMPLATES = {
  "Passport (35x45 mm)": { aspect: 35 / 45 },
  "Visa / OCI (2x2 inch)": { aspect: 1 },
};

const App = () => {
  const [step, setStep] = useState('upload'); // upload | crop | print
  const [imageSrc, setImageSrc] = useState(null);
  
  // List of people added
  const [printQueue, setPrintQueue] = useState([]);
  
  // Crop & Edit State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(35 / 45); 
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  
  // Print State
  const [printLayout, setPrintLayout] = useState('6x4'); 
  const [printPreview, setPrintPreview] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    preload().catch(console.warn);
  }, []);

  // --- LIVE PREVIEW EFFECT ---
  // When quantity changes AND we are on the print screen, update immediately
  useEffect(() => {
    if (step === 'print' && printQueue.length > 0) {
      handleGenerateSheet(printLayout, printQueue);
    }
  }, [printQueue, step, printLayout]); // Re-run if Queue or Layout changes

  const handleUpload = (e) => {
    if (e.target.files?.length > 0) {
      const url = URL.createObjectURL(e.target.files[0]);
      setImageSrc(url);
      setStep('crop');
      setRotation(0);
      setZoom(1);
      setBgColor('#ffffff');
    }
  };

  const handleAddToQueue = async () => {
    try {
      const croppedBase64 = await getCroppedImg(imageSrc, croppedAreaPixels, rotation, bgColor);
      
      const newItem = {
        id: Date.now(),
        src: croppedBase64,
        count: 4 // Default copies
      };
      
      setPrintQueue(prev => [...prev, newItem]);
      setImageSrc(null);
      setStep('upload'); 
    } catch (e) {
      console.error(e);
    }
  };

  const updateQuantity = (id, delta) => {
    setPrintQueue(prevQueue => prevQueue.map(item => {
      if (item.id === id) {
        const newCount = Math.max(1, item.count + delta);
        return { ...item, count: newCount };
      }
      return item;
    }));
  };

  const removeItem = (id) => {
    setPrintQueue(prev => prev.filter(i => i.id !== id));
    // If queue becomes empty, go back to upload
    if (printQueue.length <= 1) {
        setStep('upload');
    }
  };

  // We pass 'currentQueue' explicitly to avoid stale state issues during live updates
  const handleGenerateSheet = async (layoutOverride = null, currentQueue = printQueue) => {
    const layout = layoutOverride || printLayout;
    if (currentQueue.length === 0) return;
    
    setIsGenerating(true);
    
    let flatSequence = [];
    currentQueue.forEach(item => {
      for(let i=0; i < item.count; i++) {
        flatSequence.push(item.src);
      }
    });

    const sheetBlobUrl = await generatePrintSheet(flatSequence, layout);
    setPrintPreview(sheetBlobUrl);
    setIsGenerating(false);
  };

  return (
    <div className="app-container">
      
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
           <h2>My Photos</h2>
           <span className="badge">{printQueue.length}</span>
        </div>

        <div className="queue-list">
          {printQueue.length === 0 ? (
            <div className="empty-state">
              <Users size={32} />
              <p>No photos yet.</p>
            </div>
          ) : (
            printQueue.map((item) => (
              <div key={item.id} className="queue-card">
                <div className="card-image">
                  <img src={item.src} alt="Crop" />
                </div>
                
                <div className="card-controls">
                  <div className="qty-wrapper">
                    <button className="qty-btn" onClick={() => updateQuantity(item.id, -1)}><Minus size={14}/></button>
                    <span className="qty-number">{item.count}</span>
                    <button className="qty-btn" onClick={() => updateQuantity(item.id, 1)}><Plus size={14}/></button>
                  </div>
                  <span className="copies-label">copies</span>
                </div>

                <button className="delete-btn" onClick={() => removeItem(item.id)}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          {step === 'print' ? (
             <button className="btn-secondary full" onClick={() => setStep('upload')}>
               <UserPlus size={18} /> Add Person
             </button>
          ) : (
            printQueue.length > 0 && (
              <button className="btn-primary full" onClick={() => setStep('print')}>
                <Printer size={18} /> Print Sheet &rarr;
              </button>
            )
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        
        {/* UPLOAD SCREEN */}
        {step === 'upload' && (
          <div className="center-panel fade-in">
            <div className="upload-card">
              <div className="icon-zone">
                <ImageIcon size={48} />
              </div>
              <h1>Add Person</h1>
              <p>Upload a photo to crop and add to the sheet.</p>
              
              <label className="big-upload-btn">
                <Plus size={24} /> Upload Photo
                <input type="file" accept="image/*" onChange={handleUpload} hidden />
              </label>
            </div>
          </div>
        )}

        {/* EDIT SCREEN */}
        {step === 'crop' && (
          <div className="crop-panel fade-in">
            <div className="crop-workspace">
               <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onRotationChange={setRotation}
                  onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                  onZoomChange={setZoom}
                  objectFit="contain"
                  style={{ containerStyle: { backgroundColor: bgColor } }}
                />
            </div>
            
            <div className="crop-controls">
               <h3>Adjust Photo</h3>
               
               <div className="control-row">
                 <label>Size</label>
                 <select value={aspect} onChange={(e) => setAspect(parseFloat(e.target.value))}>
                   {Object.entries(TEMPLATES).map(([name, data]) => (
                     <option key={name} value={data.aspect}>{name}</option>
                   ))}
                 </select>
               </div>

               <div className="control-row">
                  <label>Background</label>
                  <div className="color-row">
                    {['#ffffff', '#1e90ff', '#ff4757', '#dff9fb', '#f1f2f6'].map(c => (
                       <div key={c} className="swatch" style={{background: c, border: bgColor===c ? '2px solid #333': '1px solid #ddd'}} onClick={() => setBgColor(c)}/>
                    ))}
                  </div>
               </div>

               <button className="btn-magic" onClick={() => { setIsRemovingBg(true); removeBackground(imageSrc).then(b => { setImageSrc(URL.createObjectURL(b)); setIsRemovingBg(false) }) }}>
                 {isRemovingBg ? 'Processing...' : '✨ Remove Background'}
               </button>

               <div className="control-row sliders">
                  <label>Zoom & Rotate</label>
                  <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e=>setZoom(e.target.value)} />
                  <input type="range" min={0} max={360} value={rotation} onChange={e=>setRotation(e.target.value)} />
               </div>

               <div className="action-row">
                 <button className="btn-text" onClick={() => setImageSrc(null)}>Cancel</button>
                 <button className="btn-primary" onClick={handleAddToQueue}>
                    <CheckCircle size={18} /> Add to Sheet
                 </button>
               </div>
            </div>
          </div>
        )}

        {/* PRINT PREVIEW SCREEN */}
        {step === 'print' && (
          <div className="print-panel fade-in">
            <div className="print-header">
               <h2>Print Preview</h2>
               <div className="header-controls">
                  <label>Paper:</label>
                  <select value={printLayout} onChange={(e) => setPrintLayout(e.target.value)}>
                      <option value="6x4">4x6 inch (8 Photos)</option>
                      <option value="A4">A4 (30 Photos)</option>
                  </select>
               </div>
            </div>
            
            <div className="preview-container">
               {isGenerating && !printPreview ? (
                 <div className="loading">Generating Preview...</div>
               ) : (
                 <img src={printPreview} alt="Preview" className="sheet-image" />
               )}
            </div>
            
            <div className="print-footer">
               <button className="btn-download" onClick={() => saveAs(printPreview, 'passport-photos.jpg')}>
                 <Download size={20} /> Download Image
               </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;
