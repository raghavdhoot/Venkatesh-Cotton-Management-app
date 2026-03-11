import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Search, Plus, FileText, X, Truck, MapPin, Package, Save, Hash, Trash2 } from 'lucide-react';

function Javak({ currentUser }) {
    const [currentEntryId, setCurrentEntryId] = useState(null);
    const [searchGatePass, setSearchGatePass] = useState('');
    const [isNewEntry, setIsNewEntry] = useState(false);
    
    const [gatePassNo, setGatePassNo] = useState('');
    const [entryDate, setEntryDate] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [destination, setDestination] = useState('');
    const [commodity, setCommodity] = useState('');
    const [grossWt, setGrossWt] = useState('');
    const [tareWt, setTareWt] = useState('');
    const [numberOfBags, setNumberOfBags] = useState('');
    const [driverName, setDriverName] = useState('');
    const [transportName, setTransportName] = useState('');
    
    const [recentJavakEntries, setRecentJavakEntries] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'javakEntries'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entriesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRecentJavakEntries(entriesData);
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
        setTransportName('');
        setIsFormOpen(false);
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
                setTransportName(entryData.transportName || '');
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
        if (!gatePassNo || !entryDate || !vehicleNumber || !destination || !commodity || !grossWt || !tareWt || !numberOfBags) return;

        const parsedGrossWt = parseFloat(grossWt || 0);
        const parsedTareWt = parseFloat(tareWt || 0);
        const netWt = parsedGrossWt - parsedTareWt;

        const entryData = {
            gatePassNo,
            date: entryDate,
            vehicleNumber,
            destination,
            commodity,
            grossWt: parsedGrossWt,
            tareWt: parsedTareWt,
            netWt: parseFloat(netWt.toFixed(2)),
            numberOfBags: parseInt(numberOfBags, 10),
            driverName: driverName || null,
            transportName: transportName || null,
            entryMaker: currentUser.name,
            timestamp: serverTimestamp()
        };

        try {
            const entryRef = doc(db, 'javakEntries', gatePassNo);
            if (currentEntryId) {
                await updateDoc(entryRef, entryData);
                alert('Entry updated successfully');
            } else {
                await setDoc(entryRef, entryData);
                alert('New entry created successfully');
            }
            resetForm();
        } catch (error) {
            console.error("Error saving/updating document: ", error);
            alert('Error saving entry');
        }
    };

    const handleDeleteEntry = async (id) => {
        if (window.confirm(`Are you sure you want to delete Gate Pass No: ${id}?`)) {
            try {
                await deleteDoc(doc(db, 'javakEntries', String(id)));
                alert('Entry deleted successfully');
            } catch (error) {
                console.error("Error deleting entry: ", error);
                alert('Error deleting entry');
            }
        }
    };

    const generateJavakPdf = async (entryToPrint) => {
        const pdfContentElement = document.createElement('div');
        pdfContentElement.className = "p-8 bg-white w-[210mm]";
        
        const slipHtml = `
            <div class="border-2 border-slate-900 p-6 space-y-4 mb-8">
                <div class="text-center border-b border-slate-900 pb-2">
                    <h2 class="text-2xl font-bold">VENKATESH COTTON CO.</h2>
                    <p class="text-xs">NH752, Pomnala, Maharashtra 431801</p>
                    <h3 class="text-lg font-bold mt-1 underline uppercase">Outgoing Gate Pass</h3>
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="space-y-2">
                            <p><strong>Gate Pass No:</strong> ${entryToPrint.gatePassNo || entryToPrint.id}</p>
                            <p><strong>Vehicle No:</strong> ${entryToPrint.vehicleNumber}</p>
                            <p><strong>Driver:</strong> ${entryToPrint.driverName || 'N/A'}</p>
                            <p><strong>Transport:</strong> ${entryToPrint.transportName || 'N/A'}</p>
                            <p><strong>Destination:</strong> ${entryToPrint.destination}</p>
                            <p><strong>Commodity:</strong> ${entryToPrint.commodity}</p>
                        </div>
                    <div class="text-right space-y-2">
                        <p><strong>Date:</strong> ${entryToPrint.date}</p>
                        <p><strong>No. of Bags:</strong> ${entryToPrint.numberOfBags}</p>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4 pt-4 border-t border-slate-900 text-center font-bold">
                    <div class="border border-slate-900 p-2">Gross: ${entryToPrint.grossWt} kg</div>
                    <div class="border border-slate-900 p-2">Tare: ${entryToPrint.tareWt} kg</div>
                    <div class="border border-slate-900 p-2 bg-slate-50">Net: ${entryToPrint.netWt} kg</div>
                </div>
                <div class="flex justify-between pt-8 text-xs font-bold">
                    <p>Driver Signature</p>
                    <p>Security Signature</p>
                    <p>Authorized Signatory</p>
                </div>
            </div>
        `;

        pdfContentElement.innerHTML = `
            ${slipHtml}
            <div class="border-b-2 border-dashed border-slate-300 my-8"></div>
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
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={handleLookupEntry} className="btn-primary flex-1 md:flex-none flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> Load/Create
                    </button>
                    <button onClick={resetForm} className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2">
                        <X className="w-4 h-4" /> Clear
                    </button>
                </div>
            </div>

            {/* Form Section */}
            {isFormOpen && (
                <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900">
                            {isNewEntry ? 'New Outgoing Entry' : 'Update Outgoing Entry'} - Gate Pass: {gatePassNo}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isNewEntry ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isNewEntry ? 'NEW' : 'EDITING'}
                        </span>
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
                                <input type="text" className="input-field pl-10" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} required placeholder="MH-12-AB-1234" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Destination</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input type="text" className="input-field pl-10" value={destination} onChange={(e) => setDestination(e.target.value)} required placeholder="e.g., Mumbai" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Commodity</label>
                            <div className="relative">
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input type="text" className="input-field pl-10" value={commodity} onChange={(e) => setCommodity(e.target.value)} required placeholder="e.g., Cotton Bales" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Gross Wt (kg)</label>
                            <input type="number" step="0.01" className="input-field" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Tare Wt (kg)</label>
                            <input type="number" step="0.01" className="input-field" value={tareWt} onChange={(e) => setTareWt(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Net Wt (kg)</label>
                            <input type="text" className="input-field bg-slate-50 font-bold text-indigo-600" value={calculateNetWt()} readOnly disabled />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">No. of Bags</label>
                            <input type="number" className="input-field" value={numberOfBags} onChange={(e) => setNumberOfBags(e.target.value)} required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Driver Name</label>
                            <input type="text" className="input-field" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="e.g., Rajesh Kumar" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Transport Name</label>
                            <input type="text" className="input-field" value={transportName} onChange={(e) => setTransportName(e.target.value)} placeholder="e.g., VCC Logistics" />
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
                                        <button 
                                            onClick={() => handleDeleteEntry(entry.gatePassNo || entry.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                            title="Delete Entry"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
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
