import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, limit, serverTimestamp, getDocs, doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Search, Plus, FileText, Download, Save, X, Trash2 } from 'lucide-react';

function Aavak({ currentUser }) {
    const [currentEntryId, setCurrentEntryId] = useState(null);
    const [searchToken, setSearchToken] = useState('');
    const [isNewEntry, setIsNewEntry] = useState(false);
    const [billingDate, setBillingDate] = useState('');
    const [tokenNo, setTokenNo] = useState('');
    const [itemName, setItemName] = useState('');
    const [Name, setName] = useState('');    
    const [Village, setVillage] = useState('');    
    const [vehicleNo, setVehicleNo] = useState('');
    const [grossWt, setGrossWt] = useState('');
    const [tareWt, setTareWt] = useState('');
    const [rate, setRate] = useState('');
    const [amountPaid, setAmountPaid] = useState('');
    const [paymentMode, setPaymentMode] = useState('CASH');
    const [accountantName, setAccountantName] = useState('');
    const [makerName, setMakerName] = useState('');
    const [recentEntries, setRecentEntries] = useState([]);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        if (statusMessage.text) {
            const timer = setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    useEffect(() => {
        if (currentUser) {
            if (paymentMode === 'CASH') {
                setAccountantName(currentUser.name);
                setMakerName('');
            } else {
                setMakerName(currentUser.name);
                setAccountantName('');
            }
        }
    }, [paymentMode, currentUser]);

    useEffect(() => {
        const q = query(collection(db, 'cottonEntries'), orderBy('timestamp', 'desc'), limit(20));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entriesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRecentEntries(entriesData);
        }, (error) => {
            console.error("Error fetching real-time data: ", error);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setCurrentEntryId(null);
        setSearchToken('');
        setIsNewEntry(false);
        setBillingDate('');
        setTokenNo('');
        setItemName('');
        setName('');
        setVillage('');
        setVehicleNo('');
        setGrossWt('');
        setTareWt('');
        setRate('');
        setAmountPaid('');
        setPaymentMode('CASH');
        setAccountantName(currentUser?.name || '');
        setMakerName('');
    };

    const handleLookupEntry = async () => {
        if (!searchToken) return;
        try {
            const entryRef = doc(db, 'cottonEntries', searchToken);
            const entrySnap = await getDoc(entryRef);

            if (entrySnap.exists()) {
                const entryData = entrySnap.data();
                setCurrentEntryId(searchToken);
                setIsNewEntry(false);
                setBillingDate(entryData.billingDate || '');
                setTokenNo(entryData.tokenNo || '');
                setItemName(entryData.itemName || '');
                setName(entryData.Name || '');
                setVillage(entryData.Village || '');
                setVehicleNo(entryData.vehicleNo || '');
                setGrossWt(entryData.grossWt || '');
                setTareWt(entryData.tareWt || '');
                setRate(entryData.rate || '');
                setAmountPaid(entryData.amountPaid || '');
                setPaymentMode(entryData.paymentMode || 'CASH');
                setAccountantName(entryData.accountantName || '');
                setMakerName(entryData.makerName || '');
            } else {
                resetForm();
                setIsNewEntry(true);
                setTokenNo(searchToken);
            }
        } catch (error) {
            console.error("Error looking up entry: ", error);
        }
    };

    const exportToExcel = async () => {
        const allEntriesSnapshot = await getDocs(query(collection(db, 'cottonEntries'), orderBy('timestamp', 'desc')));
        const allEntries = allEntriesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                timestamp: data.timestamp?.toDate()?.toLocaleDateString() || ''
            };
        });

        if (allEntries.length === 0) return;

        const worksheet = XLSX.utils.json_to_sheet(allEntries);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Cotton Entries");
        XLSX.writeFile(workbook, "VCC_Cotton_Entries.xlsx");
    };

    const handleDeleteEntry = async (id) => {
        try {
            await deleteDoc(doc(db, 'cottonEntries', String(id)));
            setDeleteConfirmId(null);
            setStatusMessage({ text: 'Entry deleted successfully', type: 'success' });
        } catch (error) {
            console.error("Error deleting entry: ", error);
            setStatusMessage({ text: 'Error deleting entry', type: 'error' });
        }
    };

    const handleSaveOrUpdateEntry = async (e) => {
        e.preventDefault();
        if (!tokenNo) return;

        const parsedGrossWt = parseFloat(grossWt || 0);
        const parsedTareWt = parseFloat(tareWt || 0);
        const parsedRate = parseFloat(rate || 0);
        const parsedAmountPaid = parseFloat(amountPaid || 0);

        let netWt = 0;
        let netWtAfterDeduction = 0;
        let hamaliDeduction = 0;
        let grossAmount = 0;
        let netAmount = 0;
        let balanceAmount = 0;
        const weighmentCharges = 50;

        if (parsedGrossWt && parsedTareWt) {
            netWt = parsedGrossWt - parsedTareWt;
            netWtAfterDeduction = netWt * 0.986;
            hamaliDeduction = netWt * 15;
        }

        if (parsedRate && netWtAfterDeduction) {
            grossAmount = parsedRate * netWtAfterDeduction;
            netAmount = Math.round(grossAmount - hamaliDeduction - weighmentCharges);
        }
        
        if (parsedAmountPaid > netAmount) {
            setStatusMessage({ text: `Warning: Amount Paid (₹${parsedAmountPaid}) is more than Net Amount (₹${netAmount})`, type: 'error' });
        }

        balanceAmount = Math.round(netAmount - parsedAmountPaid);

        const entryData = {
            billingDate: billingDate || null,
            tokenNo: tokenNo || null,
            itemName: itemName || null,
            Name: Name || null,
            Village: Village || null,
            vehicleNo: vehicleNo || null,
            grossWt: parsedGrossWt || null,
            tareWt: parsedTareWt || null,
            rate: parsedRate || null,
            netWt: parseFloat(netWt.toFixed(2)) || null,
            netWtAfterDeduction: parseFloat(netWtAfterDeduction.toFixed(2)) || null,
            hamaliDeduction: parseFloat(hamaliDeduction.toFixed(2)) || null,
            grossAmount: parseFloat(grossAmount.toFixed(2)) || null,
            netAmount: netAmount || null,
            amountPaid: Math.round(parsedAmountPaid) || null,
            balanceAmount: balanceAmount || null,
            paymentMode: paymentMode || null,
            accountantName: accountantName || null,
            makerName: makerName || null,
            entryMaker: currentUser.name,
            timestamp: serverTimestamp(),
        };

        try {
            const entryRef = doc(db, 'cottonEntries', tokenNo);
            if (currentEntryId) {
                await updateDoc(entryRef, entryData);
                setStatusMessage({ text: 'Entry updated successfully', type: 'success' });
            } else {
                await setDoc(entryRef, entryData);
                setStatusMessage({ text: 'New entry created successfully', type: 'success' });
            }
            resetForm();
        } catch (error) {
            console.error("Error saving/updating entry: ", error);
            setStatusMessage({ text: 'Error saving entry', type: 'error' });
        }
    };

    const generatePdf = async (entryToPrint) => {
        const pdfContentElement = document.createElement('div');
        pdfContentElement.className = "p-4 bg-white w-[210mm]";
        
        const createSlipHtml = (copyType, copyColor) => `
            <div class="border-2 border-slate-900 mb-4 overflow-hidden font-sans text-slate-900">
                <div class="text-center py-4 border-b-2 border-slate-900">
                    <h1 class="text-2xl font-bold uppercase tracking-tight">VENKATESH COTTON COMPANY</h1>
                    <p class="text-[10px] font-medium mt-1">NH752, Pomnala, Maharashtra 431801</p>
                </div>
                
                <div class="flex justify-between px-4 py-1 border-b-2 border-slate-900 bg-white">
                    <span class="font-bold uppercase text-[10px]">FARMER PURCHASE BILL</span>
                    <span class="font-bold uppercase text-[10px]" style="color: ${copyColor}">${copyType}</span>
                </div>

                <div class="grid grid-cols-3 gap-x-4 px-4 py-2 text-[10px] border-b-2 border-slate-900">
                    <div class="space-y-2">
                        <div class="flex items-end gap-1 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap">TOKEN NO.</span>
                            <div class="flex-1 font-bold px-1">${entryToPrint.tokenNo}</div>
                        </div>
                        <div class="flex items-end gap-1 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap">VILLAGE</span>
                            <div class="flex-1 font-bold px-1">${entryToPrint.Village}</div>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex items-end gap-1 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap">DATE</span>
                            <div class="flex-1 font-bold px-1">${entryToPrint.billingDate}</div>
                        </div>
                        <div class="flex items-end gap-1 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap">VEHICLE NO.</span>
                            <div class="flex-1 font-bold px-1">${entryToPrint.vehicleNo}</div>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex items-end gap-1 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap">FARMER NAME</span>
                            <div class="flex-1 font-bold px-1">${entryToPrint.Name}</div>
                        </div>
                        <div class="flex items-end gap-1 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap">ITEM</span>
                            <div class="flex-1 font-bold px-1">${entryToPrint.itemName}</div>
                        </div>
                    </div>
                </div>

                <table class="w-full border-collapse text-[10px]">
                    <thead>
                        <tr class="border-b-2 border-slate-900">
                            <th class="border-r-2 border-slate-900 p-1 text-left w-[50%] uppercase font-bold">Description</th>
                            <th class="border-r-2 border-slate-900 p-1 text-left w-[25%] uppercase font-bold">Weight/Rate</th>
                            <th class="p-1 text-left w-[25%] uppercase font-bold">Amount</th>
                        </tr>
                    </thead>
                    <tbody class="font-bold">
                        <tr class="border-b border-slate-300">
                            <td class="border-r-2 border-slate-900 p-1 py-2">Gross Weight / Tare Weight</td>
                            <td class="border-r-2 border-slate-900 p-1 py-2 text-right">${entryToPrint.grossWt} / ${entryToPrint.tareWt} kg</td>
                            <td class="p-1 py-2"></td>
                        </tr>
                        <tr class="border-b border-slate-300">
                            <td class="border-r-2 border-slate-900 p-1 py-2">Net Weight</td>
                            <td class="border-r-2 border-slate-900 p-1 py-2 text-right">${entryToPrint.netWt} kg</td>
                            <td class="p-1 py-2"></td>
                        </tr>
                        <tr class="border-b border-slate-300">
                            <td class="border-r-2 border-slate-900 p-1 py-2">Net Wt (After 1.4% Ded.)</td>
                            <td class="border-r-2 border-slate-900 p-1 py-2 text-right">${entryToPrint.netWtAfterDeduction} kg</td>
                            <td class="p-1 py-2"></td>
                        </tr>
                        <tr class="border-b-2 border-slate-900">
                            <td class="border-r-2 border-slate-900 p-1 py-2">Rate / Hamali & Weighment</td>
                            <td class="border-r-2 border-slate-900 p-1 py-2 text-right">₹${entryToPrint.rate} / ₹${entryToPrint.hamaliDeduction + 50}</td>
                            <td class="p-1 py-2 text-right">₹${entryToPrint.grossAmount} / -₹${entryToPrint.hamaliDeduction + 50}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="grid grid-cols-12 text-[10px]">
                    <div class="col-span-7 p-2 space-y-2 border-r-2 border-slate-900">
                        <div class="flex items-end gap-1 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap">PAYMENT MODE</span>
                            <div class="flex-1 font-bold px-1">${entryToPrint.paymentMode || 'CASH'}</div>
                        </div>
                        <div class="flex items-end gap-1 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap">ACCOUNTANT NAME</span>
                            <div class="flex-1 font-bold px-1">${entryToPrint.accountantName || entryToPrint.makerName || ''}</div>
                        </div>
                    </div>
                    <div class="col-span-5 p-2 space-y-1">
                        <div class="flex justify-between font-bold">
                            <span class="uppercase">Net Payable</span>
                            <span>₹ ${entryToPrint.netAmount}</span>
                        </div>
                        <div class="flex justify-between font-bold">
                            <span class="uppercase">Amount Paid</span>
                            <span>₹ ${entryToPrint.amountPaid}</span>
                        </div>
                        <div class="flex justify-between border-t border-slate-900 pt-1 text-xs font-black">
                            <span class="uppercase">Balance</span>
                            <span>₹ ${entryToPrint.balanceAmount}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        pdfContentElement.innerHTML = `
            ${createSlipHtml('APMC COPY', '#ef4444')}
            <div class="border-b border-dashed border-slate-300 my-8"></div>
            ${createSlipHtml('FARMER COPY', '#ef4444')}
        `;
        
        pdfContentElement.innerHTML = `
            ${createSlipHtml('APMC COPY', '#ef4444', 'Accountant Signature')}
            <div class="text-center my-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                ✂ CUT ALONG THIS LINE ✂
                <div class="border-b border-dashed border-slate-300 mt-1"></div>
            </div>
            ${createSlipHtml('FARMER COPY', '#ef4444', 'Farmer Signature')}
        `;

        document.body.appendChild(pdfContentElement);
        try {
            const canvas = await html2canvas(pdfContentElement, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
            pdf.save(`Bill_${entryToPrint.tokenNo}.pdf`);
        } finally {
            document.body.removeChild(pdfContentElement);
        }
    };

    const hasTareWtBeenEntered = tareWt !== '' && tareWt !== null && parseFloat(tareWt) > 0;

    return (
        <div className="space-y-8">
            {/* Search & Action Header */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="Search Token No..." 
                            className="input-field pl-10"
                            value={searchToken}
                            onChange={(e) => setSearchToken(e.target.value)}
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
                    <button onClick={resetForm} className="btn-secondary flex-1 md:flex-none flex items-center justify-center gap-2">
                        <X className="w-4 h-4" /> Clear
                    </button>
                </div>
            </div>

            {/* Form Section */}
            {(currentEntryId || isNewEntry) && (
                <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900">
                            {isNewEntry ? 'Create New Entry' : 'Update Entry'} - Token: {tokenNo}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isNewEntry ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isNewEntry ? 'NEW' : 'EDITING'}
                        </span>
                    </div>

                    <form onSubmit={handleSaveOrUpdateEntry} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Billing Date</label>
                            <input type="date" className="input-field" value={billingDate} onChange={(e) => setBillingDate(e.target.value)} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Item Name</label>
                            <input type="text" className="input-field" value={itemName} onChange={(e) => setItemName(e.target.value)} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Farmer Name</label>
                            <input type="text" className="input-field" value={Name} onChange={(e) => setName(e.target.value)} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Village</label>
                            <input type="text" className="input-field" value={Village} onChange={(e) => setVillage(e.target.value)} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Vehicle No</label>
                            <input type="text" className="input-field" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Gross Weight (kg)</label>
                            <input type="number" step="0.01" className="input-field" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Tare Weight (kg)</label>
                            <input type="number" step="0.01" className="input-field" value={tareWt} onChange={(e) => setTareWt(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Rate (₹)</label>
                            <input type="number" step="0.01" className="input-field" value={rate} onChange={(e) => setRate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Amount Paid (₹)</label>
                            <input type="number" step="0.01" className="input-field" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Mode of Payment</label>
                            <select className="input-field" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                                <option value="CASH">CASH</option>
                                <option value="RTGS">RTGS</option>
                            </select>
                        </div>
                        {paymentMode === 'CASH' ? (
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-600">Accountant Name</label>
                                <input type="text" className="input-field bg-slate-50" value={accountantName} readOnly disabled />
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-600">Maker Name</label>
                                <input type="text" className="input-field bg-slate-50" value={makerName} readOnly disabled />
                            </div>
                        )}

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
                    <h3 className="text-lg font-bold text-slate-900">Recent Incoming Entries</h3>
                    <button onClick={exportToExcel} className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold flex items-center gap-1">
                        <Download className="w-4 h-4" /> Export All
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">Token</th>
                                <th className="px-6 py-4 font-semibold">Farmer</th>
                                <th className="px-6 py-4 font-semibold">Net Wt</th>
                                <th className="px-6 py-4 font-semibold">Net Amount</th>
                                <th className="px-6 py-4 font-semibold">Balance</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {recentEntries.map(entry => (
                                <tr key={entry.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-4 text-sm">{entry.billingDate}</td>
                                    <td className="px-6 py-4 text-sm font-mono font-bold text-indigo-600">{entry.tokenNo}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <div className="font-medium text-slate-900">{entry.Name}</div>
                                        <div className="text-xs text-slate-400">{entry.Village}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium">{entry.netWt || 0} kg</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-900">₹{(entry.netAmount || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${entry.balanceAmount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            ₹{(entry.balanceAmount || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button 
                                            onClick={() => generatePdf(entry)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Download PDF"
                                        >
                                            <FileText className="w-5 h-5" />
                                        </button>
                                        {deleteConfirmId === (entry.tokenNo || entry.id) ? (
                                            <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
                                                <button 
                                                    onClick={() => handleDeleteEntry(entry.tokenNo || entry.id)}
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
                                                onClick={() => setDeleteConfirmId(entry.tokenNo || entry.id)}
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

export default Aavak;
