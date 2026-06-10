import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Search, Plus, FileText, X, Truck, MapPin, Package, Save, Hash, Trash2, Camera, History, Copy, Phone, Share2, Printer, Download } from 'lucide-react';
import { normalizeItemName } from './utils/normalization';
import { subscribeToJavak } from './components/Dashboard';

function Javak({ currentUser, onClose, setOpen }) {
    const [currentEntryId, setCurrentEntryId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');
    const [isNewEntry, setIsNewEntry] = useState(false);

    const [gatePassNo, setGatePassNo] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [destination, setDestination] = useState('');
    const [commodity, setCommodity] = useState('BALES');
    const [numberOfBags, setNumberOfBags] = useState('');
    const [grossWt, setGrossWt] = useState('');
    const [tareWt, setTareWt] = useState('');
    const [netWt, setNetWt] = useState('');
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');
    const [driverPhoto, setDriverPhoto] = useState(null);

    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);

    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const formatVehicleNumber = (val) => {
        const cleaned = val.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleaned.length <= 2) return cleaned;
        if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
        if (cleaned.length <= 6) return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 10)}`;
    };

    const runCleanupAfterSevenDays = async () => {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        const dateStr = sevenDaysAgo.toISOString().split('T')[0];
        try {
            const q = query(collection(db, 'javakEntries'), where('date', '<', dateStr));
            const snapshot = await getDocs(q);
            snapshot.forEach(async (docRef) => {
                await deleteDoc(doc(db, 'javakEntries', docRef.id));
                await deleteDoc(doc(db, 'bardana', `bardana_javak_${docRef.id}`));
            });
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        runCleanupAfterSevenDays();

        const unsubscribe = subscribeToJavak((list) => {
            setEntries(list);
            setFilteredEntries(list);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        let result = entries;

        if (globalSearch) {
            const q = globalSearch.toLowerCase();
            result = result.filter(e => 
                (e.gatePassNo && e.gatePassNo.toLowerCase().includes(q)) ||
                (e.vehicleNumber && e.vehicleNumber.toLowerCase().includes(q)) ||
                (e.driverName && e.driverName.toLowerCase().includes(q)) ||
                (e.destination && e.destination.toLowerCase().includes(q)) ||
                (e.commodity && e.commodity.toLowerCase().includes(q))
            );
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(e => 
                (e.gatePassNo && e.gatePassNo.toLowerCase().includes(q)) ||
                (e.vehicleNumber && e.vehicleNumber.toLowerCase().includes(q))
            );
        }

        setFilteredEntries(result);
    }, [globalSearch, searchQuery, entries]);

    useEffect(() => {
        const gross = parseFloat(grossWt || 0);
        const tare = parseFloat(tareWt || 0);
        if (gross > 0 && tare > 0) {
            setNetWt(Math.max(0, gross - tare).toFixed(2));
        } else {
            setNetWt('');
        }
    }, [grossWt, tareWt]);

    const handleSelectEntry = (entry) => {
        setCurrentEntryId(entry.id);
        setGatePassNo(entry.gatePassNo || '');
        setDate(entry.date || '');
        setVehicleNumber(entry.vehicleNumber || '');
        setDestination(entry.destination || '');
        setCommodity(entry.commodity || 'BALES');
        setNumberOfBags(entry.numberOfBags || '');
        setGrossWt(entry.grossWt || '');
        setTareWt(entry.tareWt || '');
        setNetWt(entry.netWt || '');
        setDriverName(entry.driverName || '');
        setDriverPhone(entry.driverPhone || '');
        setDriverPhoto(entry.driverPhoto || null);
        setIsNewEntry(false);
    };

    const handleShareWhatsApp = (tx) => {
        const messageText = `*Venkatesh Cotton Company Gate Pass*\n\nGate Pass No: ${tx.gatePassNo || tx.id}\nDate: ${tx.date}\nVehicle: ${tx.vehicleNumber}\nDestination: ${tx.destination}\nDriver Name: ${tx.driverName}\nCommodity: ${tx.commodity}\nNo. of Bags: ${tx.numberOfBags}\nNet Wt: ${tx.netWt} kg\n\nThank you, Have a safe journey!`;
        const phone = tx.driverPhone ? tx.driverPhone.replace(/[^0-9]/g, '') : '';
        const url = phone ? `https://api.whatsapp.com/send?phone=91${phone}&text=${encodeURIComponent(messageText)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
        window.open(url, '_blank');
    };

    const handleExportToExcel = () => {
        const rows = filteredEntries.map(entry => ({
            "Gate Pass No": entry.gatePassNo || entry.id || '',
            "Date": entry.date || '',
            "Vehicle Number": entry.vehicleNumber || '',
            "Destination": entry.destination || '',
            "Driver Name": entry.driverName || '',
            "Driver Phone": entry.driverPhone || '',
            "Commodity": entry.commodity || '',
            "Number of Bags": entry.numberOfBags || '',
            "Gross Weight": entry.grossWt || '',
            "Tare Weight": entry.tareWt || '',
            "Net Weight": entry.netWt || ''
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Javak Reports");
        XLSX.writeFile(workbook, `Javak_Export_${new Date().toLocaleDateString('en-CA')}.xlsx`);
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 300 } });
            setCameraStream(stream);
            setIsCameraActive(true);
            setTimeout(() => {
                const video = document.getElementById('camera-preview');
                if (video) video.srcObject = stream;
            }, 100);
        } catch (err) {
            console.error("Camera opening failed:", err);
            setStatusMessage({ text: 'Unable to start camera streams.', type: 'error' });
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraActive(false);
    };

    const capturePhoto = () => {
        const video = document.getElementById('camera-preview');
        if (!video) return;
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setDriverPhoto(dataUrl);
        stopCamera();
    };

    const generateJavakPdf = async (entryToPrint) => {
        const pdfContentElement = document.createElement('div');
        pdfContentElement.className = "p-8 bg-white w-[210mm]";

        const data = entryToPrint;
        const slipHtml = `
            <div class="border-2 border-slate-900 p-3 mb-2 relative overflow-hidden flex gap-4 font-sans text-slate-900 bg-white" style="height: 80mm;">
                ${data.driverPhoto ? `
                    <div class="flex-shrink-0 flex items-center justify-center border border-slate-300 p-0.5 rounded bg-white">
                        <img src="${data.driverPhoto}" style="width: 20mm; height: 26mm; object-fit: cover;" />
                    </div>
                ` : `
                    <div class="flex-shrink-0 flex flex-col items-center justify-center border border-dashed border-slate-300 p-1 rounded bg-slate-50" style="width: 20mm; height: 26mm;">
                        <span class="text-[6px] font-black uppercase text-slate-400">Security No Photo</span>
                    </div>
                `}

                <div class="flex-1 flex flex-col justify-between">
                    <div class="text-center pb-1.5 border-b border-double border-slate-800">
                        <h1 class="text-lg font-black uppercase tracking-tight">VENKATESH COTTON COMPANY</h1>
                        <p class="text-[8px] font-bold">Pomnala, Maharashtra 431801 | Mob: +91 9876543210</p>
                    </div>

                    <div class="flex justify-between items-center py-1 border-b border-slate-300 bg-slate-50 px-2 my-0.5">
                        <span class="font-black text-[9px] tracking-wider uppercase">OUTWARD DISPATCH GATE PASS</span>
                        <span class="font-extrabold text-[8px] tracking-wider text-amber-600 uppercase">TRIPLICATE VERIFICATION</span>
                    </div>

                    <div class="grid grid-cols-3 gap-2 text-[9px] border-b border-slate-300 pb-1.5">
                        <div class="space-y-1">
                            <div><span class="font-bold text-slate-500 uppercase text-[7px]">Gate Pass No:</span> <span class="font-black">${data.gatePassNo}</span></div>
                            <div><span class="font-bold text-slate-500 uppercase text-[7px]">Destination:</span> <span class="font-black uppercase">${data.destination}</span></div>
                        </div>
                        <div class="space-y-1">
                            <div><span class="font-bold text-slate-500 uppercase text-[7px]">Truck Reg No:</span> <span class="font-black text-xs">${data.vehicleNumber}</span></div>
                            <div><span class="font-bold text-slate-500 uppercase text-[7px]">Date Issued:</span> <span class="font-black">${data.date}</span></div>
                        </div>
                        <div class="space-y-1">
                            <div><span class="font-bold text-slate-500 uppercase text-[7px]">Driver Name:</span> <span class="font-black uppercase">${data.driverName || 'N/A'}</span></div>
                            <div><span class="font-bold text-slate-500 uppercase text-[7px]">Contact:</span> <span class="font-black">${data.driverPhone || 'N/A'}</span></div>
                        </div>
                    </div>

                    <div class="grid grid-cols-4 gap-2 text-[9px] bg-slate-50/50 p-1.5 border-b border-slate-300">
                        <div><span class="font-bold text-slate-400 text-[6px] uppercase block">Commodity</span><span class="font-black">${data.commodity}</span></div>
                        <div><span class="font-bold text-slate-400 text-[6px] uppercase block">No of Bags/Bales</span><span class="font-black">${data.numberOfBags}</span></div>
                        <div><span class="font-bold text-slate-400 text-[6px] uppercase block">Gross Weight</span><span class="font-bold">${data.grossWt} kg</span></div>
                        <div><span class="font-bold text-slate-400 text-[6px] uppercase block">Tare Weight</span><span class="font-bold">${data.tareWt} kg</span></div>
                    </div>

                    <div class="flex items-center justify-between pt-1">
                        <div>
                            <span class="text-[7px] font-bold text-slate-400 uppercase block">Calculated Net Payload</span>
                            <span class="text-sm font-black text-emerald-600">${data.netWt} kg</span>
                        </div>
                        <div class="flex gap-6 text-[8px] font-bold text-slate-500 uppercase mt-auto">
                            <div class="text-center pt-2">
                                <p class="border-t border-slate-600 px-3">Driver Sig</p>
                            </div>
                            <div class="text-center pt-2">
                                <p class="border-t border-slate-600 px-3">Authority Stamp</p>
                            </div>
                        </div>
                    </div>
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

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!isNewEntry && !currentEntryId) return;

        setStatusMessage({ text: 'Saving ...', type: 'info' });

        const payload = {
            gatePassNo: gatePassNo.trim().toUpperCase(),
            date: date,
            vehicleNumber: formatVehicleNumber(vehicleNumber),
            destination: destination.trim().toUpperCase(),
            commodity: commodity,
            numberOfBags: numberOfBags ? parseInt(numberOfBags, 10) : 0,
            grossWt: grossWt !== '' ? parseFloat(grossWt) : 0,
            tareWt: tareWt !== '' ? parseFloat(tareWt) : 0,
            netWt: netWt !== '' ? parseFloat(netWt) : 0,
            driverName: driverName.trim().toUpperCase(),
            driverPhone: driverPhone.trim(),
            driverPhoto: driverPhoto,
            updatedAt: serverTimestamp()
        };

        const docId = gatePassNo.trim().toUpperCase();

        try {
            if (isNewEntry) {
                await setDoc(doc(db, 'javakEntries', docId), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    makerId: currentUser?.employeeId || 'ADMIN',
                    makerName: currentUser?.name || 'ADMIN'
                });

                // Write matching OUT transaction to bardana collection (Real-time updates)
                if (numberOfBags && parseInt(numberOfBags) > 0) {
                    const bardanaId = `bardana_javak_${docId}`;
                    await setDoc(doc(db, 'bardana', bardanaId), {
                        itemName: 'BARDANA (GUNNY BAGS)',
                        quantity: parseInt(numberOfBags, 10),
                        personName: driverName.toUpperCase() || 'DRIVER',
                        employeeName: currentUser?.name || 'N/A',
                        type: 'OUT',
                        entryMaker: currentUser?.name || 'ADMIN',
                        timestamp: serverTimestamp(),
                        referenceId: docId
                    });
                }

                setStatusMessage({ text: 'Gatepass generated successfully!', type: 'success' });
            } else {
                await setDoc(doc(db, 'javakEntries', docId), payload, { merge: true });
                
                // If ID is changed, clean old records
                if (currentEntryId && currentEntryId !== docId) {
                    await deleteDoc(doc(db, 'javakEntries', currentEntryId));
                    await deleteDoc(doc(db, 'bardana', `bardana_javak_${currentEntryId}`));
                }

                // Write/update matching OUT transaction to bardana collection
                if (numberOfBags && parseInt(numberOfBags) > 0) {
                    const bardanaId = `bardana_javak_${docId}`;
                    await setDoc(doc(db, 'bardana', bardanaId), {
                        itemName: 'BARDANA (GUNNY BAGS)',
                        quantity: parseInt(numberOfBags, 10),
                        personName: driverName.toUpperCase() || 'DRIVER',
                        employeeName: currentUser?.name || 'N/A',
                        type: 'OUT',
                        entryMaker: currentUser?.name || 'ADMIN',
                        timestamp: serverTimestamp(),
                        referenceId: docId
                    });
                } else {
                    await deleteDoc(doc(db, 'bardana', `bardana_javak_${docId}`));
                }

                setStatusMessage({ text: 'Gatepass details updated successfully!', type: 'success' });
            }

            // Enforce explicit modal / window close triggers immediately on success
            resetState();
            if (onClose) onClose();
            if (setOpen) setOpen(false);

        } catch (error) {
            console.error("Firestore write failed: ", error);
            setStatusMessage({ text: 'Database write error. Please retry.', type: 'error' });
        }
    };

    const handleDeleteEntry = async (id) => {
        try {
            await deleteDoc(doc(db, 'javakEntries', id));
            await deleteDoc(doc(db, 'bardana', `bardana_javak_${id}`));
            setStatusMessage({ text: 'Gatepass entry deleted.', type: 'success' });
            setDeleteConfirmId(null);
            resetState();
        } catch (error) {
            console.error("Firestore deletion failed: ", error);
            setStatusMessage({ text: 'Deletion error. Please retry.', type: 'error' });
        }
    };

    const resetState = () => {
        setCurrentEntryId(null);
        setGatePassNo('');
        setDate(new Date().toISOString().split('T')[0]);
        setVehicleNumber('');
        setDestination('');
        setCommodity('BALES');
        setNumberOfBags('');
        setGrossWt('');
        setTareWt('');
        setNetWt('');
        setDriverName('');
        setDriverPhone('');
        setDriverPhoto(null);
        stopCamera();
        setIsNewEntry(false);
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
                    <button onClick={handleExportToExcel} className="btn-secondary flex items-center gap-2">
                        <Download className="w-4 h-4" /> Export
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
                    statusMessage.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-950/20' :
                    statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' :
                    'bg-amber-50 text-amber-700 dark:bg-slate-800 dark:text-amber-400'
                }`}>
                    <span>{statusMessage.text}</span>
                    <button onClick={() => setStatusMessage({ text: '', type: '' })} className="font-bold">✕</button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-6">
                    {(isNewEntry || currentEntryId) && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-widest">{isNewEntry ? 'Generate Active Gatepass' : 'Adjust Active Gatepass Info'}</h3>
                                <button type="button" onClick={resetState} className="text-xs text-slate-400 font-bold hover:text-slate-600">✕ Close</button>
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
                                        <input type="number" step="0.01" className="input-field font-bold dark:bg-slate-800" value={tareWt} onChange={(e) => setTareWt(e.target.value)} required placeholder="Filled weight" />
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
                                    <button type="button" onClick={resetState} className="p-3 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 rounded-xl text-xs font-black dark:text-white uppercase">Cancel</button>
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
