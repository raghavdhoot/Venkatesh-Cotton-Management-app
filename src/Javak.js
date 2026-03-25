import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, addDoc, getDocs, where } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Search, Plus, FileText, X, Truck, MapPin, Package, Save, Hash, Trash2, Camera, History, Copy } from 'lucide-react';

function Javak({ currentUser }) {
    const [currentEntryId, setCurrentEntryId] = useState(null);
    const [searchGatePass, setSearchGatePass] = useState('');
    const [isNewEntry, setIsNewEntry] = useState(false);
    const [lastEntry, setLastEntry] = useState(null);
    
    const [gatePassNo, setGatePassNo] = useState('');
    const [entryDate, setEntryDate] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [destination, setDestination] = useState('');
    const [commodity, setCommodity] = useState('');
    const [grossWt, setGrossWt] = useState('');
    const [tareWt, setTareWt] = useState('');
    const [numberOfBags, setNumberOfBags] = useState('');
    const [driverName, setDriverName] = useState('');
    const [driverPhoto, setDriverPhoto] = useState(null);
    const [bardanaType, setBardanaType] = useState('BARDANA');
    const [sutliCount, setSutliCount] = useState('');
    
    const [recentJavakEntries, setRecentJavakEntries] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        if (statusMessage.text) {
            const timer = setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    useEffect(() => {
        const q = query(collection(db, 'javakEntries'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entriesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRecentJavakEntries(entriesData);
            if (entriesData.length > 0) {
                setLastEntry(entriesData[0]);
            }
        }, (error) => {
            console.error("Error fetching javak entries: ", error);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setCurrentEntryId(null);
        setSearchGatePass('');
        setIsNewEntry(false);
        setGatePassNo('');
        setEntryDate('');
        setVehicleNumber('');
        setDestination('');
        setCommodity('');
        setGrossWt('');
        setTareWt('');
        setNumberOfBags('');
        setDriverName('');
        setDriverPhoto(null);
        setBardanaType('BARDANA');
        setSutliCount('');
        setIsFormOpen(false);
    };

    const handleRepeatLastEntry = () => {
        if (!lastEntry) return;
        setEntryDate(new Date().toISOString().split('T')[0]);
        setVehicleNumber(lastEntry.vehicleNumber || '');
        setDestination(lastEntry.destination || '');
        setCommodity(lastEntry.commodity || '');
        setBardanaType(lastEntry.bardanaType || 'BARDANA');
        setDriverName(lastEntry.driverName || '');
        setIsFormOpen(true);
    };

    const handleLookupEntry = async () => {
        if (!searchGatePass) return;
        try {
            const entryRef = doc(db, 'javakEntries', searchGatePass);
            const entrySnap = await getDoc(entryRef);

            if (entrySnap.exists()) {
                const entryData = entrySnap.data();
                setCurrentEntryId(searchGatePass);
                setIsNewEntry(false);
                setGatePassNo(entryData.gatePassNo || searchGatePass);
                setEntryDate(entryData.date || '');
                setVehicleNumber(entryData.vehicleNumber || '');
                setDestination(entryData.destination || '');
                setCommodity(entryData.commodity || '');
                setGrossWt(entryData.grossWt || '');
                setTareWt(entryData.tareWt || '');
                setNumberOfBags(entryData.numberOfBags || '');
                setDriverName(entryData.driverName || '');
                setDriverPhoto(entryData.driverPhoto || null);
                setBardanaType(entryData.bardanaType || 'BARDANA');
                setSutliCount(entryData.sutliCount || '');
                setIsFormOpen(true);
            } else {
                resetForm();
                setIsNewEntry(true);
                setGatePassNo(searchGatePass);
                setIsFormOpen(true);
            }
        } catch (error) {
            console.error("Error looking up entry: ", error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!gatePassNo || !entryDate || !vehicleNumber) return;

        const parsedGrossWt = parseFloat(grossWt || 0);
        const parsedTareWt = parseFloat(tareWt || 0);
        const netWt = parsedGrossWt - parsedTareWt;

        const entryData = {
            gatePassNo,
            date: entryDate,
            vehicleNumber,
            destination: destination || null,
            commodity: commodity || null,
            grossWt: parsedGrossWt || null,
            tareWt: parsedTareWt || null,
            netWt: parseFloat(netWt.toFixed(2)) || null,
            numberOfBags: numberOfBags ? parseInt(numberOfBags, 10) : null,
            bardanaType: bardanaType || null,
            sutliCount: sutliCount ? parseInt(sutliCount, 10) : 0,
            driverName: driverName || null,
            driverPhoto: driverPhoto || null,
            entryMaker: currentUser.name,
            timestamp: serverTimestamp()
        };

        try {
            const entryRef = doc(db, 'javakEntries', gatePassNo);
            if (currentEntryId) {
                await updateDoc(entryRef, entryData);
                
                // Update Bardana entries: Delete old ones and add new ones
                const q = query(collection(db, 'bardanaEntries'), where('javakId', '==', gatePassNo));
                const snap = await getDocs(q);
                for (const d of snap.docs) {
                    await deleteDoc(doc(db, 'bardanaEntries', d.id));
                }

                if (numberOfBags) {
                    await addDoc(collection(db, 'bardanaEntries'), {
                        itemName: bardanaType,
                        quantity: parseInt(numberOfBags, 10),
                        personName: driverName || 'N/A',
                        employeeName: currentUser.name,
                        type: 'OUT',
                        entryMaker: 'System (Javak Update)',
                        javakId: gatePassNo,
                        timestamp: serverTimestamp()
                    });
                }

                if (sutliCount && parseInt(sutliCount, 10) > 0) {
                    await addDoc(collection(db, 'bardanaEntries'), {
                        itemName: 'SUTLI',
                        quantity: parseInt(sutliCount, 10),
                        personName: driverName || 'N/A',
                        employeeName: currentUser.name,
                        type: 'OUT',
                        entryMaker: 'System (Javak Update)',
                        javakId: gatePassNo,
                        timestamp: serverTimestamp()
                    });
                }

                setStatusMessage({ text: 'Entry updated successfully', type: 'success' });
            } else {
                await setDoc(entryRef, entryData);
                
                // Automatically subtract from Bardana
                if (numberOfBags) {
                    await addDoc(collection(db, 'bardanaEntries'), {
                        itemName: bardanaType,
                        quantity: parseInt(numberOfBags, 10),
                        personName: driverName || 'N/A',
                        employeeName: currentUser.name,
                        type: 'OUT',
                        entryMaker: 'System (Javak)',
                        javakId: gatePassNo,
                        timestamp: serverTimestamp()
                    });
                }

                // Also subtract Sutli if provided
                if (sutliCount && parseInt(sutliCount, 10) > 0) {
                    await addDoc(collection(db, 'bardanaEntries'), {
                        itemName: 'SUTLI',
                        quantity: parseInt(sutliCount, 10),
                        personName: driverName || 'N/A',
                        employeeName: currentUser.name,
                        type: 'OUT',
                        entryMaker: 'System (Javak)',
                        javakId: gatePassNo,
                        timestamp: serverTimestamp()
                    });
                }
                
                setStatusMessage({ text: 'New entry created successfully', type: 'success' });
            }
            resetForm();
        } catch (error) {
            console.error("Error saving/updating document: ", error);
            setStatusMessage({ text: 'Error saving entry', type: 'error' });
        }
    };

    const handleDeleteEntry = async (id) => {
        try {
            await deleteDoc(doc(db, 'javakEntries', String(id)));
            setDeleteConfirmId(null);
            setStatusMessage({ text: 'Entry deleted successfully', type: 'success' });
        } catch (error) {
            console.error("Error deleting entry: ", error);
            setStatusMessage({ text: 'Error deleting entry', type: 'error' });
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setDriverPhoto(reader.result);
            };
            reader.readAsDataURL(file);
        }
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

        document.body.appendChild(pdfContentElement);
        try {
            const canvas = await html2canvas(pdfContentElement, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
            pdf.save(`GatePass_${entryToPrint.gatePassNo || entryToPrint.vehicleNumber}.pdf`);
        } finally {
            document.body.removeChild(pdfContentElement);
        }
    };

    const formatVehicleNumber = (val) => {
        const cleaned = val.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleaned.length <= 2) return cleaned;
        if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
        if (cleaned.length <= 6) return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 10)}`;
    };

    const handleVehicleChange = (e) => {
        const formatted = formatVehicleNumber(e.target.value);
        setVehicleNumber(formatted);
    };

    const calculateNetWt = () => {
        const gross = parseFloat(grossWt);
        const tare = parseFloat(tareWt);
        if (!isNaN(gross) && !isNaN(tare)) return (gross - tare).toFixed(2);
        return '0.00';
    };

    return (
        <div className="space-y-8">
            {/* Action Header */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="Search Gate Pass No..." 
                            className="input-field pl-10"
                            value={searchGatePass}
                            onChange={(e) => setSearchGatePass(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLookupEntry()}
                        />
                    </div>
                    {statusMessage.text && (
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-right-4 whitespace-nowrap ${
                            statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {statusMessage.text}
                        </div>
                    )}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={handleLookupEntry} className="btn-primary flex-1 md:flex-none flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> Load/Create
                    </button>
                    {lastEntry && (
                        <button onClick={handleRepeatLastEntry} className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2">
                            <History className="w-4 h-4" /> Repeat Last
                        </button>
                    )}
                    {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') && (
                        <button onClick={() => generateJavakPdf({
                            gatePassNo: '__________',
                            date: '__________',
                            vehicleNumber: '__________',
                            destination: '__________',
                            commodity: '__________',
                            numberOfBags: '_____',
                            grossWt: '_____',
                            tareWt: '_____',
                            netWt: '_____',
                            driverName: '____________________'
                        })} className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2">
                            <FileText className="w-4 h-4" /> Blank Print
                        </button>
                    )}
                    <button onClick={resetForm} className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2">
                        <X className="w-4 h-4" /> Clear
                    </button>
                </div>
            </div>

            {/* Form Section */}
            {isFormOpen && (
                <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-900">
                                {isNewEntry ? 'New Outgoing Entry' : 'Update Outgoing Entry'} - Gate Pass: {gatePassNo}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${isNewEntry ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                {isNewEntry ? 'NEW' : 'EDITING'}
                            </span>
                        </div>
                        {isNewEntry && lastEntry && (
                            <button 
                                onClick={handleRepeatLastEntry}
                                className="text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1 hover:underline"
                            >
                                <Copy className="w-3 h-3" /> Repeat Last Entry
                            </button>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Gate Pass No</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input type="text" className="input-field pl-10 bg-slate-50" value={gatePassNo} readOnly disabled />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Date</label>
                            <input type="date" className="input-field" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Vehicle Number</label>
                            <div className="relative">
                                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    className="input-field pl-10 uppercase" 
                                    value={vehicleNumber} 
                                    onChange={handleVehicleChange} 
                                    required 
                                    placeholder="MH-26-BS-4852"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Destination</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input type="text" className="input-field pl-10 uppercase" value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase())} placeholder="E.G., MUMBAI" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Commodity</label>
                            <div className="relative">
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input type="text" className="input-field pl-10 uppercase" value={commodity} onChange={(e) => setCommodity(e.target.value.toUpperCase())} placeholder="E.G., COTTON BALES" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Gross Wt (kg)</label>
                            <input type="number" step="0.01" className="input-field" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Tare Wt (kg)</label>
                            <input type="number" step="0.01" className="input-field" value={tareWt} onChange={(e) => setTareWt(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Net Wt (kg)</label>
                            <input type="text" className="input-field bg-slate-50 font-bold text-indigo-600" value={calculateNetWt()} readOnly disabled />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">No. of Bags</label>
                            <input type="number" className="input-field" value={numberOfBags} onChange={(e) => setNumberOfBags(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Bardana Type</label>
                            <select 
                                className="input-field" 
                                value={bardanaType} 
                                onChange={(e) => setBardanaType(e.target.value)}
                            >
                                <option value="BARDANA">BARDANA (GUNNY BAGS)</option>
                                <option value="PLASTIC BARDANA">PLASTIC BARDANA</option>
                                <option value="OLD BAGS">OLD BAGS</option>
                                <option value="NEW BAGS">NEW BAGS</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Sutli Used (Qty)</label>
                            <input 
                                type="number" 
                                className="input-field" 
                                value={sutliCount} 
                                onChange={(e) => setSutliCount(e.target.value)} 
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Driver Name</label>
                            <input type="text" className="input-field uppercase" value={driverName} onChange={(e) => setDriverName(e.target.value.toUpperCase())} placeholder="e.g., RAJESH KUMAR" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Driver Photo</label>
                            <div className="flex items-center gap-4">
                                <label className="flex-1 flex items-center justify-center gap-2 p-2 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-slate-50 transition-all">
                                    <Camera className="w-5 h-5 text-slate-400" />
                                    <span className="text-sm text-slate-500">Upload Photo</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                                </label>
                                {driverPhoto && (
                                    <div className="relative w-12 h-12">
                                        <img src={driverPhoto} alt="Preview" className="w-full h-full object-cover rounded-lg border border-slate-200" />
                                        <button type="button" onClick={() => setDriverPhoto(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
                            <button type="submit" className="btn-primary flex items-center gap-2">
                                <Save className="w-4 h-4" /> {isNewEntry ? 'Save Entry' : 'Update Entry'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Table Section */}
            <div className="card overflow-hidden !p-0">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900">Recent Outgoing Entries</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">Gate Pass</th>
                                <th className="px-6 py-4 font-semibold">Vehicle No</th>
                                <th className="px-6 py-4 font-semibold">Destination</th>
                                <th className="px-6 py-4 font-semibold">Net Wt</th>
                                <th className="px-6 py-4 font-semibold">Bags</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {recentJavakEntries
                                .sort((a, b) => (a.destination || '').localeCompare(b.destination || ''))
                                .map(entry => (
                                <tr key={entry.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 text-sm">{entry.date}</td>
                                    <td className="px-6 py-4 text-sm font-mono font-bold text-indigo-600">{entry.gatePassNo || entry.id}</td>
                                    <td className="px-6 py-4 text-sm">{entry.vehicleNumber}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{entry.destination}</td>
                                    <td className="px-6 py-4 text-sm font-bold">{entry.netWt?.toFixed(2)} kg</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">
                                            {entry.numberOfBags} Bags
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button 
                                            onClick={() => generateJavakPdf(entry)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Download Gate Pass"
                                        >
                                            <FileText className="w-5 h-5" />
                                        </button>
                                        {deleteConfirmId === (entry.gatePassNo || entry.id) ? (
                                            <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
                                                <button 
                                                    onClick={() => handleDeleteEntry(entry.gatePassNo || entry.id)}
                                                    className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700 transition-colors"
                                                >
                                                    Confirm
                                                </button>
                                                <button 
                                                    onClick={() => setDeleteConfirmId(null)}
                                                    className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-300 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setDeleteConfirmId(entry.gatePassNo || entry.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                title="Delete Entry"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Javak;
