import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, where, documentId } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Search, Plus, FileText, X, Truck, MapPin, Package, Save, Hash, Trash2, Camera, History, Copy, Phone, Share2 } from 'lucide-react';
import { normalizeItemName } from './utils/normalization';

function Javak({ currentUser }) {
    const [currentEntryId, setCurrentEntryId] = useState(null);
    const [isNewEntry, setIsNewEntry] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

    const [gatePassNo, setGatePassNo] = useState('');
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [destination, setDestination] = useState('');
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');
    const [commodity, setCommodity] = useState('BALES');
    const [numberOfBags, setNumberOfBags] = useState('');
    const [grossWt, setGrossWt] = useState('');
    const [tareWt, setTareWt] = useState('');
    const [netWt, setNetWt] = useState('');

    const [isCameraActive, setIsCameraActive] = useState(false);
    const [driverPhoto, setDriverPhoto] = useState(null);
    const [videoStream, setVideoStream] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const runCleanupAfterSevenDays = async () => {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        const dateStr = sevenDaysAgo.toISOString().split('T')[0];
        try {
            const q = query(collection(db, 'javak'), where('date', '<', dateStr));
            const snapshot = await getDocs(q);
            snapshot.forEach(async (docRef) => {
                await deleteDoc(doc(db, 'javak', docRef.id));
            });
        } catch (error) {
            console.error("Historical cleanup failed: ", error);
        }
    };

    useEffect(() => {
        runCleanupAfterSevenDays();

        const q = query(collection(db, 'javak'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setEntries(list);
            setFilteredEntries(list);
        }, (error) => {
            console.error("Firestore loading error: ", error);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const lowerSearch = searchQuery.toLowerCase();
        const filtered = entries.filter(e => 
            (e.gatePassNo && e.gatePassNo.toLowerCase().includes(lowerSearch)) ||
            (e.vehicleNumber && e.vehicleNumber.toLowerCase().includes(lowerSearch)) ||
            (e.destination && e.destination.toLowerCase().includes(lowerSearch)) ||
            (e.commodity && e.commodity.toLowerCase().includes(lowerSearch)) ||
            (e.driverName && e.driverName.toLowerCase().includes(lowerSearch))
        );
        setFilteredEntries(filtered);
    }, [searchQuery, entries]);

    const parsedGross = parseFloat(grossWt || 0);
    const parsedTare = parseFloat(tareWt || 0);

    useEffect(() => {
        if (parsedGross > 0 && parsedTare > 0) {
            const calculatedNet = Math.max(0, parsedGross - parsedTare);
            setNetWt(calculatedNet);
        } else {
            setNetWt('');
        }
    }, [parsedGross, parsedTare]);

    const startCamera = async () => {
        setIsCameraActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            setVideoStream(stream);
            const videoElement = document.getElementById('camera-preview');
            if (videoElement) {
                videoElement.srcObject = stream;
            }
        } catch (error) {
            console.error("Error accessing camera: ", error);
            setStatusMessage({ text: 'Unable to access camera. Please check permissions.', type: 'error' });
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            setVideoStream(null);
        }
        setIsCameraActive(false);
    };

    const capturePhoto = () => {
        const videoElement = document.getElementById('camera-preview');
        const canvasElement = document.createElement('canvas');
        if (videoElement) {
            canvasElement.width = videoElement.videoWidth || 320;
            canvasElement.height = videoElement.videoHeight || 240;
            const ctx = canvasElement.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            const photoUrl = canvasElement.toDataURL('image/jpeg');
            setDriverPhoto(photoUrl);
            stopCamera();
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setStatusMessage({ text: 'Saving Gatepass record...', type: 'info' });

        const payload = {
            gatePassNo: gatePassNo.toUpperCase() || null,
            date: date || new Date().toLocaleDateString('en-CA'),
            vehicleNumber: formatVehicleNumber(vehicleNumber) || null,
            destination: destination.toUpperCase() || null,
            driverName: driverName.toUpperCase() || '',
            driverPhone: driverPhone || '',
            commodity: commodity || 'BALES',
            numberOfBags: numberOfBags ? parseInt(numberOfBags) : null,
            grossWt: grossWt ? parseFloat(grossWt) : null,
            tareWt: tareWt ? parseFloat(tareWt) : null,
            netWt: netWt ? parseFloat(netWt) : null,
            driverPhoto: driverPhoto || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        try {
            if (isNewEntry) {
                const docId = `javak_${Date.now()}`;
                await setDoc(doc(db, 'javak', docId), payload);
                setStatusMessage({ text: 'Gatepass generated successfully!', type: 'success' });
                resetState();
            } else {
                await updateDoc(doc(db, 'javak', currentEntryId), payload);
                setStatusMessage({ text: 'Gatepass details updated successfully!', type: 'success' });
            }
        } catch (error) {
            console.error("Error saving to Firestore: ", error);
            setStatusMessage({ text: 'Error executing transaction. Try again.', type: 'error' });
        }
    };

    const handleDeleteEntry = async (id) => {
        try {
            await deleteDoc(doc(db, 'javak', id));
            setStatusMessage({ text: 'Gatepass entry deleted.', type: 'success' });
            setDeleteConfirmId(null);
            resetState();
        } catch (error) {
            console.error("Firestore deletion failed: ", error);
            setStatusMessage({ text: 'Deletion error. Please retry.', type: 'error' });
        }
    };

    const handleShareWhatsApp = (tx) => {
        const messageText = `*Venkatesh Cotton Company Gate Pass*\n\nGate Pass No: ${tx.gatePassNo || tx.id}\nDate: ${tx.date}\nVehicle: ${tx.vehicleNumber}\nDestination: ${tx.destination}\nDriver Name: ${tx.driverName}\nCommodity: ${tx.commodity}\nNo. of Bags: ${tx.numberOfBags}\nNet Wt: ${tx.netWt} kg\n\nThank you, Have a safe journey!`;
        window.open('https://api.whatsapp.com/send?phone=91' + tx.driverPhone + '&text=' + encodeURIComponent(messageText), '_blank');
    };

    const generateJavakPdf = async (entryToPrint) => {
        const pdfContentElement = document.createElement('div');
        pdfContentElement.className = "p-2 bg-white w-[210mm]";
        
        const slipHtml = `
            <div class="border-2 border-slate-900 p-3 mb-2 relative overflow-hidden flex gap-4">
                <!-- Left Side: Main Details -->
                <div class="flex-1">
                    <div class="text-center mb-3">
                        <h1 class="text-xl font-bold text-blue-700 uppercase">Venkatesh Cotton Co.</h1>
                        <p class="text-[9px] text-slate-600">NH752, Pomnala, Maharashtra 431801</p>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-1.5">
                        <div class="border border-slate-300 p-1.5 rounded">
                            <p class="text-[8px] text-slate-500 uppercase font-bold">Vehicle no.</p>
                            <p class="text-xs font-semibold">${entryToPrint.vehicleNumber}</p>
                        </div>
                        <div class="border border-slate-300 p-1.5 rounded">
                            <p class="text-[8px] text-slate-500 uppercase font-bold">Date</p>
                            <p class="text-xs font-semibold">${entryToPrint.date}</p>
                        </div>
                        <div class="border border-slate-300 p-1.5 rounded">
                            <p class="text-[8px] text-slate-500 uppercase font-bold">Destination</p>
                            <p class="text-xs font-semibold">${entryToPrint.destination}</p>
                        </div>
                        <div class="border border-slate-300 p-1.5 rounded">
                            <p class="text-[8px] text-slate-500 uppercase font-bold">Driver Name</p>
                            <p class="text-xs font-semibold">${entryToPrint.driverName || 'N/A'}</p>
                        </div>
                        <div class="border border-slate-300 p-1.5 rounded">
                            <p class="text-[8px] text-slate-500 uppercase font-bold">Commodity</p>
                            <p class="text-xs font-semibold">${entryToPrint.commodity}</p>
                        </div>
                        <div class="border border-slate-300 p-1.5 rounded">
                            <p class="text-[8px] text-slate-500 uppercase font-bold">Bags</p>
                            <p class="text-xs font-bold">${entryToPrint.numberOfBags}</p>
                        </div>
                        <div class="border border-slate-300 p-1.5 rounded col-span-2">
                            <div class="grid grid-cols-3 gap-1">
                                <div>
                                    <p class="text-[8px] text-slate-500 uppercase font-bold">Gross</p>
                                    <p class="text-[10px] font-semibold">${entryToPrint.grossWt} kg</p>
                                </div>
                                <div>
                                    <p class="text-[8px] text-slate-500 uppercase font-bold">Tare</p>
                                    <p class="text-[10px] font-semibold">${entryToPrint.tareWt} kg</p>
                                </div>
                                <div>
                                    <p class="text-[8px] text-slate-500 uppercase font-bold">Net</p>
                                    <p class="text-[10px] font-bold text-indigo-700">${entryToPrint.netWt} kg</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Side: Gate Pass & Photo -->
                <div class="w-32 flex flex-col items-center">
                    <div class="border border-slate-900 p-1 mb-2 w-full text-center">
                        <p class="text-[7px] text-slate-500 uppercase font-bold">Gate Pass No.</p>
                        <p class="text-sm font-bold text-blue-700">${entryToPrint.gatePassNo || entryToPrint.id}</p>
                    </div>
                    ${entryToPrint.driverPhoto ? `
                    <div class="border border-slate-900 p-0.5 bg-slate-50">
                        <img src="${entryToPrint.driverPhoto}" class="w-[30mm] h-[40mm] object-cover" />
                        <p class="text-[7px] text-center font-bold mt-0.5 uppercase">Driver Photo</p>
                    </div>
                    ` : `
                    <div class="w-[30mm] h-[40mm] border-2 border-dashed border-slate-300 flex items-center justify-center">
                        <p class="text-[8px] text-slate-300 uppercase font-bold text-center">No Photo<br>Available</p>
                    </div>
                    `}
                </div>
            </div>
        `;
        
        pdfContentElement.innerHTML = `
            ${slipHtml}
            <div class="border-b border-dashed border-slate-300 my-2"></div>
            ${slipHtml}
            <div class="border-b border-dashed border-slate-300 my-2"></div>
            ${slipHtml}
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            @media print {
                body > *:not(#print-section) {
                    display: none !important;
                }
                #print-section {
                    display: block !important;
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    background: white !important;
                }
            }
        `;
        document.head.appendChild(style);
        pdfContentElement.id = 'print-section';
        document.body.appendChild(pdfContentElement);

        const images = pdfContentElement.getElementsByTagName('img');
        const imagePromises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        });
        await Promise.all(imagePromises);

        window.print();
        document.body.removeChild(pdfContentElement);
        document.head.removeChild(style);
    };

    const formatVehicleNumber = (val) => {
        const cleaned = val.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleaned.length <= 2) return cleaned;
        if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
        if (cleaned.length <= 6) return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 10)}`;
    };

    const handleSelectEntry = (entry) => {
        setCurrentEntryId(entry.id);
        setIsNewEntry(false);
        setGatePassNo(entry.gatePassNo || '');
        setDate(entry.date || '');
        setVehicleNumber(entry.vehicleNumber || '');
        setDestination(entry.destination || '');
        setDriverName(entry.driverName || '');
        setDriverPhone(entry.driverPhone || '');
        setCommodity(entry.commodity || 'BALES');
        setNumberOfBags(entry.numberOfBags || '');
        setGrossWt(entry.grossWt || '');
        setTareWt(entry.tareWt || '');
        setNetWt(entry.netWt || '');
        setDriverPhoto(entry.driverPhoto || null);
    };

    const resetState = () => {
        setCurrentEntryId(null);
        setIsNewEntry(false);
        setGatePassNo('');
        setDate(new Date().toLocaleDateString('en-CA'));
        setVehicleNumber('');
        setDestination('');
        setDriverName('');
        setDriverPhone('');
        setCommodity('BALES');
        setNumberOfBags('');
        setGrossWt('');
        setTareWt('');
        setNetWt('');
        setDriverPhoto(null);
        stopCamera();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 font-extrabold text-xl">
                        J
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Javak Gate Pass</h1>
                        <p className="text-xs text-slate-500">Outward Bales & Seed Gatepasses, Weight Inspections & Truck Dispatch Desk</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => { resetState(); setIsNewEntry(true); }}
                        className="btn-primary flex items-center gap-2 bg-amber-600 hover:bg-amber-700 border-none shadow-md shadow-amber-100"
                    >
                        <Plus className="w-4 h-4" /> New Gate Pass
                    </button>
                    {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') && (
                        <button onClick={() => generateJavakPdf({
                            gatePassNo: '__________',
                            date: '__________',
                            vehicleNumber: '__________',
                            destination: '__________',
                            driverName: '__________',
                            commodity: '__________',
                            numberOfBags: '__________',
                            grossWt: '_____',
                            tareWt: '_____',
                            netWt: '_____'
                        })} className="btn-secondary flex-shrink-0 flex items-center justify-center gap-2">
                            <Printer className="w-4 h-4" /> Blank Print
                        </button>
                    )}
                </div>
            </div>

            {statusMessage.text && (
                <div className={`p-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-between ${
                    statusMessage.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' :
                    statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                    'bg-amber-50 text-amber-600 dark:bg-slate-800'
                }`}>
                    <span>{statusMessage.text}</span>
                    <button onClick={() => setStatusMessage({ text: '', type: '' })} className="font-bold">✕</button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-6">
                    {(isNewEntry || currentEntryId) && (
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-6 shadow-sm">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest">{isNewEntry ? 'Generate gate pass' : 'Modify outward gate pass details'}</h3>
                                <button onClick={resetState} className="p-1 px-3 bg-slate-50 dark:bg-slate-800 dark:text-white hover:bg-slate-100 rounded-lg text-xs">✕ Close</button>
                            </div>

                            <form onSubmit={handleFormSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Gate Pass No *</label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input type="text" className="input-field pl-9 uppercase font-mono font-bold dark:bg-slate-800 dark:border-slate-700" value={gatePassNo} onChange={(e) => setGatePassNo(e.target.value)} required placeholder="GP-750" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Billing date</label>
                                        <input type="date" className="input-field dark:bg-slate-800 dark:border-slate-700" value={date} onChange={(e) => setDate(e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Commodity Cargo</label>
                                        <select className="input-field font-bold dark:bg-slate-800 dark:border-slate-700" value={commodity} onChange={(e) => setCommodity(e.target.value)}>
                                            <option value="BALES">COTTON BALES</option>
                                            <option value="COTTON SEED">COTTON SEED</option>
                                            <option value="KAPAS">KAPAS RAW</option>
                                            <option value="OIL TANKER">COTTON SEED OIL</option>
                                            <option value="COCONUT HUSK">OTHER BY-PROD</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Vehicle Registration *</label>
                                        <div className="relative">
                                            <Truck className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input type="text" className="input-field pl-9 uppercase font-mono font-bold dark:bg-slate-800 dark:border-slate-700" value={vehicleNumber} onChange={(e) => setVehicleNumber(formatVehicleNumber(e.target.value))} required placeholder="MH-26-Y-9000" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Cargo Destination *</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input type="text" className="input-field pl-9 uppercase font-bold dark:bg-slate-800 dark:border-slate-700" value={destination} onChange={(e) => setDestination(e.target.value)} required placeholder="e.g. GUJARAT, COIMBATORE" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">No. of Bales/Bags *</label>
                                        <div className="relative">
                                            <Package className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input type="number" className="input-field pl-9 font-bold dark:bg-slate-800" value={numberOfBags} onChange={(e) => setNumberOfBags(e.target.value)} required placeholder="Bales qty" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 bg-slate-50 dark:bg-slate-800/20 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-5 border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Truck Gross Weight (kg) *</label>
                                        <input type="number" step="0.01" className="input-field font-bold dark:bg-slate-800" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} required placeholder="Empty weight" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Truck Tare Weight (kg) *</label>
                                        <input type="number" step="0.01" className="input-field font-bold dark:bg-slate-800" value={tareWt} onChange={(e) => set開areWt ? setTareWt(e.target.value) : setTareWt(e.target.value)} required placeholder="Filled weight" />
                                    </div>
                                    <div className="flex flex-col justify-center items-center p-3 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-lg">
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1">Calculated Net Weight</span>
                                        <span className="text-base font-black text-indigo-700 dark:text-blue-400">{netWt || '0.00'} kg</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Driver KYC Details</h4>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Driver Full Name</label>
                                            <input type="text" className="input-field uppercase dark:bg-slate-800" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Name as per DL" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Driver Phone Number</label>
                                            <input type="text" className="input-field dark:bg-slate-800" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="WhatsApp Contact" />
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Security Snapshot Camera</span>
                                        
                                        {driverPhoto ? (
                                            <div className="relative border border-slate-300 dark:border-slate-700 p-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                <img src={driverPhoto} className="w-[120px] h-[150px] object-cover rounded" />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setDriverPhoto(null)} 
                                                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : isCameraActive ? (
                                            <div className="relative flex flex-col items-center">
                                                <video id="camera-preview" autoPlay playsInline className="w-[200px] h-[150px] object-cover rounded-lg border border-slate-300 dark:border-slate-700 bg-black" />
                                                <div className="flex gap-2 mt-2">
                                                    <button type="button" onClick={capturePhoto} className="p-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded uppercase">Capture</button>
                                                    <button type="button" onClick={stopCamera} className="p-2 py-1 bg-slate-500 hover:bg-slate-600 text-white text-[10px] font-bold rounded uppercase">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button 
                                                type="button" 
                                                onClick={startCamera} 
                                                className="p-4 px-6 border-2 border-dashed border-indigo-200 hover:border-indigo-400 dark:border-slate-800 dark:hover:border-slate-700 rounded-xl flex flex-col items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase"
                                            >
                                                <Camera className="w-5 h-5" /> Activate Cam DL Verification
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <button 
                                        type="submit" 
                                        className="p-3 px-6 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-amber-100 dark:shadow-none flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" /> Issue Gate Pass
                                    </button>
                                    <button type="button" onClick={resetState} className="p-3 px-6 bg-slate-105 hover:bg-slate-200 rounded-xl text-xs font-black dark:text-white uppercase">Cancel</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-4">
                        <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest">Active Dispatch Log (Last 7 Days)</h3>
                        
                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-150 dark:border-slate-800 text-[9px] font-black uppercase text-slate-500 tracking-widest whitespace-nowrap">
                                        <th className="px-5 py-3">Gatepass No</th>
                                        <th className="px-5 py-3">Truck Details</th>
                                        <th className="px-5 py-3">Cargo Spec</th>
                                        <th className="px-5 py-3">Weight Specs</th>
                                        <th className="px-5 py-3">Driver Profile</th>
                                        <th className="px-5 py-3 text-right">Gatepass Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                    {filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center p-8 text-xs font-semibold text-slate-400 uppercase">No active outward dispatches</td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map(e => (
                                            <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors whitespace-nowrap">
                                                <td className="px-5 py-4 font-mono font-bold text-slate-900 dark:text-white">{e.gatePassNo || e.id}</td>
                                                <td className="px-5 py-4">
                                                    <div className="font-mono font-bold text-slate-900 dark:text-white">{e.vehicleNumber}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase">{e.destination} | {e.date}</div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="font-bold text-slate-900 dark:text-white">{e.commodity}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono font-bold">Qty: {e.numberOfBags} Bales</div>
                                                </td>
                                                <td className="px-5 py-4 font-mono font-semibold">
                                                    <div>Net: <span className="font-bold text-slate-900 dark:text-white">{e.netWt} kg</span></div>
                                                    <div className="text-[9px] text-slate-400">G: {e.grossWt} | T: {e.tareWt}</div>
                                                </td>
                                                <td className="px-5 py-4 flex items-center gap-2">
                                                    {e.driverPhoto && (
                                                        <img src={e.driverPhoto} className="w-8 h-10 object-cover rounded border border-slate-200" />
                                                    )}
                                                    <div>
                                                        <div className="font-extrabold text-slate-900 dark:text-white">{e.driverName || 'N/A'}</div>
                                                        <div className="text-[10px] text-slate-400">{e.driverPhone || 'N/A'}</div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button 
                                                            onClick={() => generateJavakPdf(e)} 
                                                            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg text-slate-500 dark:text-slate-400"
                                                            title="Download PDF"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>

                                                        {e.driverPhone && (
                                                            <button 
                                                                onClick={() => handleShareWhatsApp(e)} 
                                                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100/50 rounded-lg text-emerald-600"
                                                                title="Share DL slip via WhatsApp"
                                                            >
                                                                <Share2 className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        <button 
                                                            onClick={() => handleSelectEntry(e)} 
                                                            className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-600 text-[10px] font-bold uppercase rounded p-1 px-3 ml-1"
                                                        >
                                                            Edit
                                                        </button>
                                                        
                                                        {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') && (
                                                            <button 
                                                                onClick={() => setDeleteConfirmId(e.id)} 
                                                                className="p-1.5 text-slate-400 hover:text-red-600"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-2xl shadow-xs space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <Search className="w-4 h-4 text-slate-400" />
                            <h4 className="text-[10px] font-black uppercase text-slate-900 dark:text-white tracking-widest">Verify Outlet Gate Pass</h4>
                        </div>
                        <input 
                            type="text" 
                            className="input-field font-mono font-bold dark:bg-slate-800 text-xs" 
                            placeholder="SEARCH GATEPASS NO / VEHICLE..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {deleteConfirmId && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-3">
                    <div className="bg-white dark:bg-slate-900 max-w-sm w-full p-6 rounded-2xl text-center space-y-4 shadow-xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                        <h4 className="font-extrabold text-slate-900 dark:text-white uppercase text-sm tracking-wide">Are you absolute sure?</h4>
                        <p className="text-xs text-slate-500">This action permanently purges this gatepass outwards record database logs.</p>
                        <div className="flex items-center justify-center gap-3">
                            <button onClick={() => handleDeleteEntry(deleteConfirmId)} className="btn-primary bg-red-600 hover:bg-red-700 font-bold text-xs p-2 px-6 uppercase tracking-wider shadow shadow-red-200">Yes Delete</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="btn-secondary text-xs uppercase font-bold p-2 px-6">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Javak;