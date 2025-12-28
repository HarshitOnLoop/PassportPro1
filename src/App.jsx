import React, { useState, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { removeBackground, preload } from '@imgly/background-removal';
import { getCroppedImg, generatePrintSheet, resizeImage } from './canvasUtils';
import { saveAs } from 'file-saver';
import { Scissors, Printer, Image as ImageIcon, Download, Sparkles, RotateCw, ArrowLeft } from 'lucide-react';
import './App.css';

const TEMPLATES = {
  "Indian Passport (35x45 mm)": { aspect: 35 / 45 },
  "Indian PAN Card (2.5x3.5 cm)": { aspect: 25 / 35 },
  "OCI / Visa (2x2 inch)": { aspect: 1 },
};

const App = () => {
  const [step, setStep] = useState('upload');
  const [imageSrc, setImageSrc] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(35 / 45); 
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [bgColor, setBgColor] = useState('#ffffff');
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  
  const [printLayout, setPrintLayout] = useState('6x4'); 
  const [printPreview, setPrintPreview] = useState(null);

  // 1. FAST START: Preload the AI model as soon as the app opens
  useEffect(() => {
    const loadModel = async () => {
      try {
        // This downloads the 100MB model in the background immediately
        await preload(); 
        console.log("AI Model Preloaded");
        setModelReady(true);
      } catch (e) {
        console.warn("Preload failed, will load on demand");
      }
    };
    loadModel();
  }, []);

  const handleUpload = (e) => {
    if (e.target.files?.length > 0) {
      const url = URL.createObjectURL(e.target.files[0]);
      setImageSrc(url);
      setStep('crop');
    }
  };

  // 2. FAST REMOVAL: Resize image before processing
  const runBackgroundRemoval = async () => {
    if (!imageSrc) return;
    setIsRemovingBg(true);
    try {
      // Step A: Downscale image to 800px width (Speed optimization)
      // This makes the AI process 10-20x faster than full 12MP photos
      const smallImageUrl = await resizeImage(imageSrc, 800);

      // Step B: Run AI on small image
      const blob = await removeBackground(smallImageUrl);
      const url = URL.createObjectURL(blob);
      setImageSrc(url);
    } catch (error) {
      alert("Error: " + error.message);
    }
    setIsRemovingBg(false);
  };

  const handleCropSave = async () => {
    try {
      const croppedBase64 = await getCroppedImg(
        imageSrc, 
        croppedAreaPixels, 
        rotation, 
        bgColor
      );
      setProcessedImage(croppedBase64);
      setStep('print');
      generateSheet(croppedBase64, '6x4');
    } catch (e) {
      console.error(e);
    }
  };

  const generateSheet = async (imgSource, layoutOverride = null) => {
    const src = imgSource || processedImage;
    const layout = layoutOverride || printLayout;
    
    if (!src) return;
    
    setPrintPreview(null); 
    const sheetBlobUrl = await generatePrintSheet(src, layout);
    setPrintPreview(sheetBlobUrl);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Passport Pro</h2>
        <nav>
          <button className={step === 'upload' ? 'active' : ''} onClick={() => setStep('upload')}>
            <ImageIcon size={20} /> Upload
          </button>
          <button className={step === 'crop' ? 'active' : ''} disabled={!imageSrc} onClick={() => setStep('crop')}>
            <Scissors size={20} /> Crop & Adjust
          </button>
          <button className={step === 'print' ? 'active' : ''} disabled={!processedImage} onClick={() => setStep('print')}>
            <Printer size={20} /> Print
          </button>
        </nav>
      </aside>

      <main className="workspace">
        {step === 'upload' && (
          <div className="upload-zone">
            <h1>Indian Passport Photo Maker</h1>
            <p>Standard Sizes • AI Background Removal</p>
            {modelReady ? (
               <small style={{color: '#00b894', fontWeight: 'bold'}}>✓ AI Ready for Fast Processing</small>
            ) : (
               <small style={{color: '#fab1a0'}}>Initializing AI...</small>
            )}
            <br/><br/>
            <label className="upload-btn">
              Upload Photo
              <input type="file" accept="image/*" onChange={handleUpload} hidden />
            </label>
          </div>
        )}

        {step === 'crop' && (
          <div className="editor-layout">
            <div className="canvas-area">
              <div className="cropper-wrap">
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
            </div>
            
            <div className="controls-panel">
               <h3>1. Size & Background</h3>
               
               <div className="control-group">
                 <label>Template</label>
                 <select onChange={(e) => setAspect(parseFloat(e.target.value))}>
                   {Object.entries(TEMPLATES).map(([name, data]) => (
                     <option key={name} value={data.aspect}>{name}</option>
                   ))}
                 </select>
               </div>

               <button className="btn-ai" onClick={runBackgroundRemoval} disabled={isRemovingBg}>
                 {isRemovingBg ? "Processing..." : <><Sparkles size={16}/> Remove Background</>}
               </button>

               <div className="control-group">
                  <label>Zoom</label>
                  <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(e.target.value)} />
               </div>

               <div className="control-group">
                  <label>Rotate ({Math.round(rotation)}°)</label>
                  <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    <RotateCw size={16} color="#666"/>
                    <input type="range" min={0} max={360} step={1} value={rotation} onChange={(e) => setRotation(e.target.value)} />
                  </div>
               </div>

               <div className="control-group">
                 <label>Background Color</label>
                 <div className="colors">
                   {['#ffffff', '#D9EAF7', '#B0D5F1', '#f0f0f0', '#d63031'].map(c => (
                     <div key={c} className="swatch" style={{background: c}} onClick={() => setBgColor(c)}/>
                   ))}
                 </div>
               </div>
               
               <button className="btn-primary" onClick={handleCropSave}>Next: Print Layout &rarr;</button>
            </div>
          </div>
        )}

        {step === 'print' && (
          <div className="editor-layout">
            <div className="canvas-area">
              {printPreview ? (
                <img src={printPreview} className="print-preview" alt="Print Sheet" />
              ) : (
                <div className="loader"></div>
              )}
            </div>
            
            <div className="controls-panel">
              <h3>2. Download Sheet</h3>
              <div className="control-group">
                <label>Paper Size</label>
                <select 
                  value={printLayout}
                  onChange={(e) => { 
                    const newLayout = e.target.value;
                    setPrintLayout(newLayout); 
                    generateSheet(processedImage, newLayout);
                  }}
                >
                  <option value="6x4">6x4 inch (Landscape - 8 Photos)</option>
                  <option value="A4">A4 (Portrait - 30 Photos)</option>
                </select>
              </div>
              
              <div className="download-options">
                <button className="btn-primary" onClick={() => saveAs(printPreview, `passport-sheet-${printLayout}.jpg`)}>
                  <Download size={18} /> Download Print Sheet
                </button>
                <button className="btn-secondary" onClick={() => saveAs(processedImage, 'passport-single.jpg')}>
                  Download Single Photo
                </button>
              </div>
              <button className="btn-text" onClick={() => setStep('crop')}>
                <ArrowLeft size={14} /> Back to Edit
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;