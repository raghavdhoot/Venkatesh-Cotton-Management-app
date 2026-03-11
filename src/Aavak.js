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
        if (window.confirm(`Are you sure you want to delete entry with Token No: ${id}?`)) {
            try {
                await deleteDoc(doc(db, 'cottonEntries', String(id)));
                alert('Entry deleted successfully');
            } catch (error) {
                console.error("Error deleting entry: ", error);
                alert('Error deleting entry');
            }
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
            netAmount = grossAmount - hamaliDeduction - weighmentCharges;
        }
        
        if (parsedAmountPaid > netAmount) {
            alert(`Warning: Amount Paid (₹${parsedAmountPaid}) is more than Net Amount (₹${netAmount.toFixed(2)})`);
        }

        balanceAmount = netAmount - parsedAmountPaid;

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
            netAmount: parseFloat(netAmount.toFixed(2)) || null,
            amountPaid: parseFloat(parsedAmountPaid.toFixed(2)) || null,
            balanceAmount: parseFloat(balanceAmount.toFixed(2)) || null,
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
            } else {
                await setDoc(entryRef, entryData);
            }
            resetForm();
        } catch (error) {
            console.error("Error saving/updating entry: ", error);
        }
    };

    const generatePdf = async (entryToPrint) => {
        const pdfContentElement = document.createElement('div');
        pdfContentElement.className = "p-8 bg-white w-[210mm]";
        pdfContentElement.innerHTML = `
            <div class="border-4 border-slate-900 p-6 space-y-6">
                <div class="text-center border-b-2 border-slate-900 pb-4">
                    <h1 class="text-3xl font-bold">VENKATESH COTTON COMPANY</h1>
                    <p class="text-sm">NH752, Pomnala, Maharashtra 431801</p>
                    <h2 class="text-xl font-bold mt-2 underline">FARMER PURCHASE BILL</h2>
                </div>
                
                <div class="grid grid-cols-2 gap-8">
                    <div class="space-y-2">
                        <p><strong>Token No:</strong> ${entryToPrint.tokenNo}</p>
                        <p><strong>Farmer Name:</strong> ${entryToPrint.Name}</p>
                        <p><strong>Village:</strong> ${entryToPrint.Village}</p>
                        <p><strong>Vehicle No:</strong> ${entryToPrint.vehicleNo}</p>
                    </div>
                    <div class="text-right space-y-2">
                        <p><strong>Date:</strong> ${entryToPrint.billingDate}</p>
                        <p><strong>Item:</strong> ${entryToPrint.itemName}</p>
                    </div>
                </div>

                <table class="w-full border-collapse border-2 border-slate-900">
                    <thead>
                        <tr class="bg-slate-100">
                            <th class="border border-slate-900 p-2">Description</th>
                            <th class="border border-slate-900 p-2">Weight/Rate</th>
                            <th class="border border-slate-900 p-2">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="border border-slate-900 p-2">Gross Weight</td>
                            <td class="border border-slate-900 p-2 text-right">${entryToPrint.grossWt} kg</td>
                            <td class="border border-slate-900 p-2"></td>
                        </tr>
                        <tr>
                            <td class="border border-slate-900 p-2">Tare Weight</td>
                            <td class="border border-slate-900 p-2 text-right">${entryToPrint.tareWt} kg</td>
                            <td class="border border-slate-900 p-2"></td>
                        </tr>
                        <tr class="font-bold">
                            <td class="border border-slate-900 p-2">Net Weight</td>
                            <td class="border border-slate-900 p-2 text-right">${entryToPrint.netWt} kg</td>
                            <td class="border border-slate-900 p-2"></td>
                        </tr>
                        <tr>
                            <td class="border border-slate-900 p-2">Net Wt (After 1.4% Ded.)</td>
                            <td class="border border-slate-900 p-2 text-right">${entryToPrint.netWtAfterDeduction} kg</td>
                            <td class="border border-slate-900 p-2"></td>
                        </tr>
                        <tr>
                            <td class="border border-slate-900 p-2">Rate</td>
                            <td class="border border-slate-900 p-2 text-right">₹${entryToPrint.rate}</td>
                            <td class="border border-slate-900 p-2 text-right">₹${entryToPrint.grossAmount}</td>
                        </tr>
                        <tr>
                            <td class="border border-slate-900 p-2">Less: Hamali & Weighment</td>
                            <td class="border border-slate-900 p-2 text-right">₹${entryToPrint.hamaliDeduction} + ₹50</td>
                            <td class="border border-slate-900 p-2 text-right">- ₹${entryToPrint.hamaliDeduction + 50}</td>
                        </tr>
                        <tr class="text-xl font-bold bg-slate-50">
                            <td colspan="2" class="border border-slate-900 p-2 text-right">NET PAYABLE</td>
                            <td class="border border-slate-900 p-2 text-right">₹${entryToPrint.netAmount}</td>
                        </tr>
                        <tr>
                            <td colspan="2" class="border border-slate-900 p-2 text-right">Amount Paid (${entryToPrint.paymentMode || 'CASH'})</td>
                            <td class="border border-slate-900 p-2 text-right">₹${entryToPrint.amountPaid}</td>
                        </tr>
                        <tr class="font-bold">
                            <td colspan="2" class="border border-slate-900 p-2 text-right">Balance Amount</td>
                            <td class="border border-slate-900 p-2 text-right">₹${entryToPrint.balanceAmount}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="grid grid-cols-2 gap-4 text-xs">
                    <p><strong>Payment Mode:</strong> ${entryToPrint.paymentMode || 'CASH'}</p>
                    <p class="text-right"><strong>${entryToPrint.paymentMode === 'RTGS' ? 'Maker' : 'Accountant'}:</strong> ${entryToPrint.paymentMode === 'RTGS' ? entryToPrint.makerName : entryToPrint.accountantName}</p>
                </div>

                <div class="flex justify-between mt-12">
                    <div class="text-center">
                        <div class="w-32 border-b border-slate-900 mb-2"></div>
                        <p class="text-xs">Farmer Signature</p>
                    </div>
                    <div class="text-center">
                        <div class="w-32 border-b border-slate-900 mb-2"></div>
                        <p class="text-xs">Authorized Signatory</p>
                    </div>
                </div>
            </div>
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
                                        <button 
                                            onClick={() => handleDeleteEntry(entry.tokenNo || entry.id)}
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

export default Aavak;
