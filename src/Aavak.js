import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, limit, serverTimestamp, getDocs, doc, getDoc, updateDoc, setDoc, deleteDoc, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Search, Plus, FileText, Download, Save, X, Trash2, Copy, Printer, History, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeItemName } from './utils/normalization';

function Aavak({ currentUser }) {
    const [currentEntryId, setCurrentEntryId] = useState(null);
    const [searchToken, setSearchToken] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');
    const [isNewEntry, setIsNewEntry] = useState(false);
    const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
    const [tokenNo, setTokenNo] = useState('');
    const [itemName, setItemName] = useState('KAPAS');
    const [Name, setName] = useState('');    
    const [farmerPhone, setFarmerPhone] = useState('');
    const [Village, setVillage] = useState('');    
    const [vehicleNo, setVehicleNo] = useState('');
    const [grossWt, setGrossWt] = useState('');
    const [tareWt, setTareWt] = useState('');
    const [moisture, setMoisture] = useState('');
    const [rate, setRate] = useState('');
    const [amountPaid, setAmountPaid] = useState('');
    const [originalAmountPaid, setOriginalAmountPaid] = useState(0);
    const [paymentMode, setPaymentMode] = useState('CASH');
    const [paymentDueDate, setPaymentDueDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [accountantName, setAccountantName] = useState('');
    const [makerName, setMakerName] = useState('');
    const [recentEntries, setRecentEntries] = useState([]);
    const [lastEntry, setLastEntry] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [showExportModal, setShowExportModal] = useState(false);

    // Form Deduction Rates/Percentages
    const [hamaliRate, setHamaliRate] = useState('');
    const [weighmentRate, setWeighmentRate] = useState('');
    const [generalDeductionPercent, setGeneralDeductionPercent] = useState('1.4');

    // Billing Settings from Firestore
    const [billingSettings, setBillingSettings] = useState({
        hamaliRate: 15,
        weighmentRate: 50,
        generalDeductionPercent: 1.4,
        cottonDeductionEnabled: false
    });

    useEffect(() => {
        const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'billing'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBillingSettings(data);
                // Dynamically sync form values if fields are currently empty
                setHamaliRate(prev => prev === '' ? (data.hamaliRate !== undefined ? data.hamaliRate.toString() : '15') : prev);
                setWeighmentRate(prev => prev === '' ? (data.weighmentRate !== undefined ? data.weighmentRate.toString() : '50') : prev);
                setGeneralDeductionPercent(prev => prev === '' ? (data.generalDeductionPercent !== undefined ? data.generalDeductionPercent.toString() : '1.4') : prev);
            }
        });
        return () => unsubscribeSettings();
    }, []);

    useEffect(() => {
        if (statusMessage.text) {
            const timer = setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    useEffect(() => {
        if (currentUser && isNewEntry) {
            if (paymentMode === 'CASH') {
                setAccountantName(currentUser.name);
                setMakerName('');
            } else {
                setMakerName(currentUser.name);
                setAccountantName('');
            }
        }
    }, [paymentMode, currentUser, isNewEntry]);

    useEffect(() => {
        const q = query(collection(db, 'cottonEntries'), orderBy('timestamp', 'desc'), limit(20));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entriesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRecentEntries(entriesData);
            if (entriesData.length > 0) {
                setLastEntry(entriesData[0]);
            }
        }, (error) => {
            console.error("Error fetching real-time data: ", error);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setCurrentEntryId(null);
        setSearchToken('');
        setIsNewEntry(false);
        setBillingDate(new Date().toISOString().split('T')[0]);
        setTokenNo('');
        setItemName('KAPAS');
        setName('');
        setFarmerPhone('');
        setVillage('');
        setVehicleNo('');
        setGrossWt('');
        setTareWt('');
        setMoisture('');
        setRate('');
        setAmountPaid('');
        setOriginalAmountPaid(0);
        setPaymentMode('CASH');
        setPaymentDueDate(new Date().toLocaleDateString('en-CA'));
        setPaymentHistory([]);
        setAccountantName(currentUser?.name || '');
        setMakerName('');
        setHamaliRate(billingSettings.hamaliRate !== undefined ? billingSettings.hamaliRate.toString() : '15');
        setWeighmentRate(billingSettings.weighmentRate !== undefined ? billingSettings.weighmentRate.toString() : '50');
        setGeneralDeductionPercent(billingSettings.generalDeductionPercent !== undefined ? billingSettings.generalDeductionPercent.toString() : '1.4');
    };

    const handleRepeatLastEntry = () => {
        if (!lastEntry) return;
        setName(lastEntry.Name || '');
        setFarmerPhone(lastEntry.farmerPhone || '');
        setVillage(lastEntry.Village || '');
        setItemName(lastEntry.itemName || 'KAPAS');
        setVehicleNo(lastEntry.vehicleNo || '');
        setRate(lastEntry.rate || '');
        setBillingDate(new Date().toISOString().split('T')[0]);
        setStatusMessage({ text: 'Last entry details copied', type: 'success' });
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
                setFarmerPhone(entryData.farmerPhone || '');
                setVillage(entryData.Village || '');
                setVehicleNo(entryData.vehicleNo || '');
                setGrossWt(entryData.grossWt || '');
                setTareWt(entryData.tareWt || '');
                setMoisture(entryData.moisture || '');
                setRate(entryData.rate || '');
                setAmountPaid(entryData.amountPaid || '');
                setOriginalAmountPaid(entryData.amountPaid || 0);
                setPaymentMode(entryData.paymentMode || 'CASH');
                setPaymentDueDate(entryData.paymentDueDate || new Date().toLocaleDateString('en-CA'));
                setPaymentHistory(entryData.paymentHistory || []);
                setAccountantName(entryData.accountantName || '');
                setMakerName(entryData.makerName || '');
                setHamaliRate(entryData.hamaliRate !== undefined ? entryData.hamaliRate.toString() : (billingSettings.hamaliRate !== undefined ? billingSettings.hamaliRate.toString() : '15'));
                setWeighmentRate(entryData.weighmentRate !== undefined ? entryData.weighmentRate.toString() : (billingSettings.weighmentRate !== undefined ? billingSettings.weighmentRate.toString() : '50'));
                setGeneralDeductionPercent(entryData.generalDeductionPercentage !== undefined ? entryData.generalDeductionPercentage.toString() : (entryData.generalDeductionPercent !== undefined ? entryData.generalDeductionPercent.toString() : (billingSettings.generalDeductionPercent !== undefined ? billingSettings.generalDeductionPercent.toString() : '1.4')));
            } else {
                resetForm();
                setIsNewEntry(true);
                setTokenNo(searchToken);
                setHamaliRate(billingSettings.hamaliRate !== undefined ? billingSettings.hamaliRate.toString() : '15');
                setWeighmentRate(billingSettings.weighmentRate !== undefined ? billingSettings.weighmentRate.toString() : '50');
                setGeneralDeductionPercent(billingSettings.generalDeductionPercent !== undefined ? billingSettings.generalDeductionPercent.toString() : '1.4');
            }
        } catch (error) {
            console.error("Error looking up entry: ", error);
        }
    };

    const exportToExcel = async (filtered = false) => {
        let entriesToExport = [];
        if (filtered && dateRange.start && dateRange.end) {
            const q = query(
                collection(db, 'cottonEntries'), 
                where('billingDate', '>=', dateRange.start),
                where('billingDate', '<=', dateRange.end)
            );
            const snap = await getDocs(q);
            entriesToExport = snap.docs.map(doc => doc.data());
        } else {
            const allEntriesSnapshot = await getDocs(query(collection(db, 'cottonEntries'), orderBy('timestamp', 'desc')));
            entriesToExport = allEntriesSnapshot.docs.map(doc => doc.data());
        }

        const formattedEntries = entriesToExport.map(data => ({
            Date: data.billingDate || '',
            Token: data.tokenNo || '',
            Farmer: data.Name || '',
            Village: data.Village || '',
            Vehicle: data.vehicleNo || '',
            Item: data.itemName || '',
            GrossWt: data.grossWt || 0,
            TareWt: data.tareWt || 0,
            NetWt: data.netWt || 0,
            Moisture: data.moisture || '',
            Rate: data.rate || 0,
            NetAmount: data.netAmount || 0,
            Paid: data.amountPaid || 0,
            Balance: data.balanceAmount || 0,
            Mode: data.paymentMode || '',
            Accountant: data.accountantName || data.makerName || '',
            EntryMaker: data.entryMaker || '',
            Timestamp: data.timestamp?.toDate()?.toLocaleString() || ''
        }));

        if (formattedEntries.length === 0) {
            setStatusMessage({ text: 'No entries found for this range', type: 'error' });
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(formattedEntries);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Cotton Entries");
        XLSX.writeFile(workbook, `VCC_Cotton_Entries_${filtered ? dateRange.start + '_to_' + dateRange.end : 'All'}.xlsx`);
        setShowExportModal(false);
    };

    const handleDeleteEntry = async (id) => {
        try {
            await deleteDoc(doc(db, 'cottonEntries', String(id)));
            await deleteDoc(doc(db, 'cashTransactions', `Cash-Token-${id}`));
            setDeleteConfirmId(null);
            setStatusMessage({ text: 'Entry deleted successfully', type: 'success' });
        } catch (error) {
            console.error("Error deleting entry: ", error);
            setStatusMessage({ text: 'Error deleting entry', type: 'error' });
        }
    };

    // Isko replace kar do apni file mein
const handleVehicleChange = (e) => {
    // Purane formatVehicleNumber ko hata kar seedhe uppercase kar diya
    const upperValue = e.target.value.toUpperCase(); 
    setVehicleNo(upperValue);
};

    const handlePhoneChange = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length <= 10) {
            setFarmerPhone(val);
        }
    };

    const handleSaveOrUpdateEntry = async (e) => {
        e.preventDefault();
        if (!tokenNo) return;

        const parsedGrossWt = parseFloat(grossWt || 0);
        const parsedTareWt = parseFloat(tareWt || 0);
        const parsedRate = parseFloat(rate || 0);
        const parsedAmountPaid = parseFloat(amountPaid || 0);
        const parsedHamaliRate = parseFloat(hamaliRate || 0);
        const parsedWeighmentRate = parseFloat(weighmentRate || 0);
        const parsedGeneralDeductionPercent = parseFloat(generalDeductionPercent || 0);

        let netWt = 0;
        let netWtAfterDeduction = 0;
        let hamaliDeduction = 0;
        let weighmentDeduction = 0;
        let grossAmount = 0;
        let netAmount = 0;
        let balanceAmount = 0;

        if (parsedGrossWt && parsedTareWt) {
            netWt = parsedGrossWt - parsedTareWt;
            
            // Cotton deductions are re-enabled exactly like standard management system
            const deductionRate = parsedGeneralDeductionPercent / 100;
            
            netWtAfterDeduction = netWt * (1 - deductionRate);
            const netWtInQuintals = netWt / 100;
            
            hamaliDeduction = netWtInQuintals * parsedHamaliRate;
            weighmentDeduction = netWtInQuintals * parsedWeighmentRate;
        }

        if (parsedRate && netWtAfterDeduction) {
            grossAmount = (parsedRate / 100) * netWtAfterDeduction;
            netAmount = Math.round(grossAmount - hamaliDeduction - weighmentDeduction);
        }
        
        if (parsedAmountPaid > netAmount) {
            setStatusMessage({ text: `Warning: Amount Paid (₹${parsedAmountPaid}) is more than Net Amount (₹${netAmount})`, type: 'error' });
        }

        balanceAmount = Math.round(netAmount - parsedAmountPaid);

        // Accountant/Maker logic
        let finalAccountant = accountantName;
        let finalMaker = makerName;
        
        const isAmountIncreased = parsedAmountPaid > (originalAmountPaid || 0);

        if (isNewEntry || isAmountIncreased) {
            if (parsedAmountPaid > 0) {
                if (paymentMode === 'CASH') {
                    finalAccountant = currentUser.name;
                    finalMaker = '';
                } else {
                    finalMaker = currentUser.name;
                    finalAccountant = '';
                }
            }
        }

        const localDateString = new Date().toLocaleDateString('en-CA');
        const isImmediate = paymentMode === 'CASH' || paymentMode === 'RTGS' || paymentMode === 'IMMEDIATE';
        const finalPaymentDueDate = isImmediate ? localDateString : (paymentDueDate || localDateString);

        const entryData = {
            billingDate: billingDate || null,
            tokenNo: tokenNo || null,
            itemName: normalizeItemName(itemName) || null,
            Name: Name || null,
            farmerPhone: farmerPhone || null,
            Village: Village || null,
            vehicleNo: vehicleNo || null,
            grossWt: parsedGrossWt || null,
            tareWt: parsedTareWt || null,
            moisture: moisture || null,
            rate: parsedRate || null,
            netWt: parseFloat(netWt.toFixed(2)) || null,
            netWtAfterDeduction: parseFloat(netWtAfterDeduction.toFixed(2)) || null,
            hamaliDeduction: parseFloat(hamaliDeduction.toFixed(2)) || null,
            weighmentDeduction: parseFloat(weighmentDeduction.toFixed(2)) || null,
            grossAmount: parseFloat(grossAmount.toFixed(2)) || null,
            netAmount: netAmount || null,
            amountPaid: Math.round(parsedAmountPaid) || null,
            balanceAmount: balanceAmount || null,
            paymentMode: paymentMode || null,
            paymentDueDate: finalPaymentDueDate,
            paymentHistory: paymentHistory || [],
            accountantName: finalAccountant || null,
            makerName: finalMaker || null,
            entryMaker: currentUser.name,
            timestamp: serverTimestamp(),
            hamaliRate: parsedHamaliRate,
            weighmentRate: parsedWeighmentRate,
            generalDeductionPercent: parsedGeneralDeductionPercent,
            generalDeductionPercentage: parsedGeneralDeductionPercent
        };

        try {
            const entryRef = doc(db, 'cottonEntries', tokenNo);
            if (currentEntryId) {
                await updateDoc(entryRef, entryData);
                setStatusMessage({ text: 'Entry updated successfully', type: 'success' });
            } else {
                await setDoc(entryRef, entryData);
                setLastEntry(entryData);
                setStatusMessage({ text: 'New entry created successfully', type: 'success' });
            }

            // Payment Method Filter for Cash Management
            if (paymentMode && paymentMode.toUpperCase() === 'CASH') {
                const cashRef = doc(db, 'cashTransactions', `Cash-Token-${tokenNo}`);
                await setDoc(cashRef, {
                    tokenNo: tokenNo,
                    farmerName: Name,
                    amountPaid: Math.round(parsedAmountPaid),
                    amount: Math.round(parsedAmountPaid),
                    type: "Farmer Payment",
                    timestamp: serverTimestamp(),
                    reason: `FARMER PAYMENT - TOKEN ${tokenNo}`,
                    recipient: Name.toUpperCase(),
                    source: 'CASH BOX',
                    recordedBy: currentUser.name
                });
            } else {
                // Delete if it transitioned or was set to another payment mode (like RTGS)
                await deleteDoc(doc(db, 'cashTransactions', `Cash-Token-${tokenNo}`));
            }

            resetForm();
        } catch (error) {
            console.error("Error saving/updating entry: ", error);
            setStatusMessage({ text: 'Error saving entry', type: 'error' });
        }
    };

    const sharePattiToWhatsApp = (tx) => {
        if (!tx || !tx.farmerPhone) return;

        const tokenNo = tx.tokenNo || '';
        const farmerName = tx.farmerName || tx.Name || '';
        const netWeight = tx.netWeight !== undefined ? tx.netWeight : (tx.netWt || 0);
        const rate = tx.rate !== undefined ? tx.rate : '';
        const netPayable = tx.netPayable !== undefined ? tx.netPayable : (tx.netAmount || 0);

        const messageText = `*VENKATESH COTTON COMPANY*
----------------------------------
*Token No:* ${tokenNo}
*Farmer:* ${farmerName}
*Net Weight:* ${netWeight} kg
*Rate:* ₹${rate}
*Net Payable:* ₹${netPayable}
----------------------------------
Note: This is a digital entry log confirmation only. Payouts are authorized strictly via your physical Token Number at the counter.`;

        window.open('https://api.whatsapp.com/send?phone=91' + tx.farmerPhone + '&text=' + encodeURIComponent(messageText), '_blank');
    };

    const handleAddInstallmentLog = async (tokenNo, installmentAmount, installmentMode) => {
        if (!tokenNo || !installmentAmount || parseFloat(installmentAmount) <= 0) {
            setStatusMessage({ text: 'Invalid installment amount', type: 'error' });
            return;
        }

        const amt = parseFloat(installmentAmount);
        const todayStrLocal = new Date().toLocaleDateString('en-CA');
        
        try {
            const entryRef = doc(db, 'cottonEntries', tokenNo);
            const entrySnap = await getDoc(entryRef);
            
            if (entrySnap.exists()) {
                const data = entrySnap.data();
                const pastHistory = data.paymentHistory || [];
                const updatedHistory = [
                    ...pastHistory,
                    {
                        amount: amt,
                        date: todayStrLocal,
                        type: installmentMode || 'CASH'
                    }
                ];

                const totalPaid = updatedHistory.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
                const netAmount = parseFloat(data.netAmount || 0);
                const newBalance = Math.max(0, netAmount - totalPaid);

                await updateDoc(entryRef, {
                    paymentHistory: updatedHistory,
                    amountPaid: totalPaid,
                    balanceAmount: newBalance
                });

                setPaymentHistory(updatedHistory);
                setAmountPaid(totalPaid);
                setOriginalAmountPaid(totalPaid);
                
                setStatusMessage({ text: 'Installment recorded successfully', type: 'success' });
                
                if (installmentMode === 'CASH') {
                    const cashRef = doc(db, 'cashTransactions', `Cash-Installment-${tokenNo}-${Date.now()}`);
                    await setDoc(cashRef, {
                        tokenNo: tokenNo,
                        farmerName: data.Name || 'UNKNOWN',
                        amountPaid: amt,
                        amount: amt,
                        type: "Farmer Payment",
                        timestamp: serverTimestamp(),
                        reason: `FARMER INSTALLMENT - TOKEN ${tokenNo}`,
                        recipient: (data.Name || 'UNKNOWN').toUpperCase(),
                        source: 'CASH BOX',
                        recordedBy: currentUser.name
                    });
                }
            } else {
                setStatusMessage({ text: 'Entry not found for token', type: 'error' });
            }
        } catch (error) {
            console.error("Error adding installment log: ", error);
            setStatusMessage({ text: 'Error adding installment log', type: 'error' });
        }
    };

    const generatePdf = async (entryToPrint, isBlank = false) => {
        const pdfContentElement = document.createElement('div');
        pdfContentElement.className = "p-8 bg-white w-[210mm]";
        
        const data = isBlank ? {
            tokenNo: '__________',
            Village: '__________',
            billingDate: '__________',
            vehicleNo: '__________',
            Name: '____________________',
            itemName: '__________',
            grossWt: '_____',
            tareWt: '_____',
            netWt: '_____',
            moisture: '_____',
            netWtAfterDeduction: '_____',
            rate: '_____',
            hamaliDeduction: 0,
            weighmentDeduction: 0,
            grossAmount: '_____',
            paymentMode: '__________',
            accountantName: '__________',
            netAmount: '_____',
            amountPaid: '_____',
            balanceAmount: '_____'
        } : entryToPrint;

        const createSlipHtml = (copyType, copyColor, sigLabel) => `
            <div class="border-2 border-slate-900 mb-4 overflow-hidden font-sans text-slate-900 bg-white">
                <div class="text-center py-3 border-b-2 border-slate-900">
                    <h1 class="text-2xl font-black uppercase tracking-tighter">VENKATESH COTTON COMPANY</h1>
                    <p class="text-[10px] font-bold mt-0.5">NH752, Pomnala, Maharashtra 431801 | Mob: +91 9876543210</p>
                </div>
                
                <div class="flex justify-between px-4 py-1.5 border-b-2 border-slate-900 bg-slate-50">
                    <span class="font-black uppercase text-[10px] tracking-widest">FARMER PURCHASE BILL</span>
                    <span class="font-black uppercase text-[10px] tracking-widest" style="color: ${copyColor}">${copyType}</span>
                </div>

                <div class="grid grid-cols-3 gap-x-6 px-4 py-2 text-[10px] border-b-2 border-slate-900">
                    <div class="space-y-2">
                        <div class="flex items-end gap-2 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap text-[8px] text-slate-500">TOKEN NO.</span>
                            <div class="flex-1 font-black px-1 text-xs">${data.tokenNo}</div>
                        </div>
                        <div class="flex items-end gap-2 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap text-[8px] text-slate-500">VILLAGE</span>
                            <div class="flex-1 font-black px-1 text-xs">${data.Village}</div>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex items-end gap-2 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap text-[8px] text-slate-500">DATE</span>
                            <div class="flex-1 font-black px-1 text-xs">${data.billingDate}</div>
                        </div>
                        <div class="flex items-end gap-2 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap text-[8px] text-slate-500">VEHICLE NO.</span>
                            <div class="flex-1 font-black px-1 text-xs">${data.vehicleNo}</div>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex items-end gap-2 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap text-[8px] text-slate-500">FARMER NAME</span>
                            <div class="flex-1 font-black px-1 text-xs">${data.Name}</div>
                        </div>
                        <div class="flex items-end gap-2 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap text-[8px] text-slate-500">ITEM NAME</span>
                            <div class="flex-1 font-black px-1 text-xs">${data.itemName}</div>
                        </div>
                    </div>
                </div>

                <table class="w-full border-collapse text-[10px]">
                    <thead>
                        <tr class="border-b-2 border-slate-900 bg-slate-50">
                            <th class="border-r-2 border-slate-900 p-1.5 text-left w-[50%] uppercase font-black">Description</th>
                            <th class="border-r-2 border-slate-900 p-1.5 text-right w-[25%] uppercase font-black">Weight/Rate</th>
                            <th class="p-1.5 text-right w-[25%] uppercase font-black">Amount</th>
                        </tr>
                    </thead>
                    <tbody class="font-bold">
                        <tr class="border-b border-slate-200">
                            <td class="border-r-2 border-slate-900 p-1.5 py-2">Gross Weight / Tare Weight</td>
                            <td class="border-r-2 border-slate-900 p-1.5 py-2 text-right">${data.grossWt} / ${data.tareWt} kg</td>
                            <td class="p-1.5 py-2"></td>
                        </tr>
                        <tr class="border-b border-slate-200">
                            <td class="border-r-2 border-slate-900 p-1.5 py-2">Net Weight</td>
                            <td class="border-r-2 border-slate-900 p-1.5 py-2 text-right">${data.netWt} kg</td>
                            <td class="p-1.5 py-2"></td>
                        </tr>
                        <tr class="border-b border-slate-200">
                            <td class="border-r-2 border-slate-900 p-1.5 py-2">Net Wt (After ${data.generalDeductionPercentage !== undefined && data.generalDeductionPercentage !== null ? data.generalDeductionPercentage : (data.generalDeductionPercent !== undefined && data.generalDeductionPercent !== null ? data.generalDeductionPercent : (billingSettings.generalDeductionPercent !== undefined ? billingSettings.generalDeductionPercent : 1.4))}% Ded.)</td>
                            <td class="border-r-2 border-slate-900 p-1.5 py-2 text-right">${data.netWtAfterDeduction} kg</td>
                            <td class="p-1.5 py-2"></td>
                        </tr>
                        <tr class="border-b-2 border-slate-900">
                            <td class="border-r-2 border-slate-900 p-1.5 py-2">Rate / Hamali & Weighment</td>
                            <td class="border-r-2 border-slate-900 p-1.5 py-2 text-right">₹${data.rate} / ₹${(data.hamaliDeduction + (data.weighmentDeduction || 0)).toFixed(2)}</td>
                            <td class="p-1.5 py-2 text-right font-black">₹${data.grossAmount} / -₹${(data.hamaliDeduction + (data.weighmentDeduction || 0)).toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="grid grid-cols-12 text-[10px]">
                    <div class="col-span-7 p-3 space-y-2 border-r-2 border-slate-900">
                        <div class="flex items-end gap-2 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap text-[8px] text-slate-500">PAYMENT MODE</span>
                            <div class="flex-1 font-black px-1">${data.paymentMode || 'CASH'}</div>
                        </div>
                        <div class="flex items-end gap-2 border-b border-dotted border-slate-400 pb-0.5">
                            <span class="font-bold uppercase whitespace-nowrap text-[8px] text-slate-500">ACCOUNTANT</span>
                            <div class="flex-1 font-black px-1">${data.accountantName || data.makerName || ''}</div>
                        </div>
                    </div>
                    <div class="col-span-5 p-3 space-y-1 bg-slate-50">
                        <div class="flex justify-between font-bold">
                            <span class="uppercase text-[8px] text-slate-500">Net Payable</span>
                            <span class="text-xs">₹ ${data.netAmount}</span>
                        </div>
                        <div class="flex justify-between font-bold">
                            <span class="uppercase text-[8px] text-slate-500">Amount Paid</span>
                            <span class="text-xs">₹ ${data.amountPaid}</span>
                        </div>
                        <div class="flex justify-between border-t-2 border-slate-900 pt-1 mt-1">
                            <span class="uppercase font-black text-[10px]">Balance</span>
                            <span class="text-sm font-black">₹ ${data.balanceAmount}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        pdfContentElement.innerHTML = `
            ${createSlipHtml('OFFICE COPY', '#1e293b', 'Receiver Signature')}
            <div class="text-center my-4 text-[8px] text-slate-400 font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-4">
                <div class="h-px bg-slate-200 flex-1"></div>
                ✂ CUT ALONG THIS LINE ✂
                <div class="h-px bg-slate-200 flex-1"></div>
            </div>
            ${createSlipHtml('FARMER COPY', '#ef4444', 'Farmer Signature')}
        `;

        document.body.appendChild(pdfContentElement);
        try {
            const canvas = await html2canvas(pdfContentElement, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
            pdf.save(isBlank ? `Blank_Bill_Template.pdf` : `Bill_${data.tokenNo}.pdf`);
        } finally {
            document.body.removeChild(pdfContentElement);
        }
    };

    const hasTareWtBeenEntered = tareWt !== '' && tareWt !== null && parseFloat(tareWt) > 0;

    const parsedGrossWtForCalc = parseFloat(grossWt || 0);
    const parsedTareWtForCalc = parseFloat(tareWt || 0);
    const parsedRateForCalc = parseFloat(rate || 0);
    let calculatedNetAmount = 0;
    if (parsedGrossWtForCalc && parsedTareWtForCalc && parsedRateForCalc) {
        const netWtLocal = parsedGrossWtForCalc - parsedTareWtForCalc;
        const parsedHamaliRate = parseFloat(hamaliRate || 0);
        const parsedWeighmentRate = parseFloat(weighmentRate || 0);
        const parsedGeneralDeductionPercent = parseFloat(generalDeductionPercent || 0);
            
        const deductionRate = parsedGeneralDeductionPercent / 100;
        const netWtAfterDeduction = netWtLocal * (1 - deductionRate);
        const netWtInQuintals = netWtLocal / 100;
        const hamaliDeduction = netWtInQuintals * parsedHamaliRate;
        const weighmentDeduction = netWtInQuintals * parsedWeighmentRate;
        const grossAmountLocal = (parsedRateForCalc / 100) * netWtAfterDeduction;
        calculatedNetAmount = Math.round(grossAmountLocal - hamaliDeduction - weighmentDeduction);
    }
    const totalPaidSoFar = paymentHistory.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const currentLiveBalance = Math.max(0, calculatedNetAmount - totalPaidSoFar);

    const [installmentLogAmount, setInstallmentLogAmount] = useState('');
    const [installmentLogMode, setInstallmentLogMode] = useState('CASH');

    const filteredEntries = recentEntries.filter(entry => 
        entry.tokenNo?.toLowerCase().includes(globalSearch.toLowerCase()) ||
        entry.Name?.toLowerCase().includes(globalSearch.toLowerCase()) ||
        entry.Village?.toLowerCase().includes(globalSearch.toLowerCase()) ||
        entry.vehicleNo?.toLowerCase().includes(globalSearch.toLowerCase())
    );

    return (
        <div className="space-y-8">
            {/* Search & Action Header */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="Search Token, Farmer, Village..." 
                            className="input-field pl-10 uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                        />
                    </div>
                    <div className="relative w-full md:w-48">
                        <input 
                            type="text" 
                            placeholder="Load Token No..." 
                            className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            value={searchToken}
                            onChange={(e) => setSearchToken(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLookupEntry()}
                        />
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <button onClick={handleLookupEntry} className="btn-primary flex-shrink-0 flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> Load/Create
                    </button>
                    {lastEntry && (
                        <button onClick={handleRepeatLastEntry} className="btn-secondary flex-shrink-0 flex items-center justify-center gap-2">
                            <History className="w-4 h-4" /> Repeat Last
                        </button>
                    )}
                    <button onClick={() => setShowExportModal(true)} className="btn-secondary flex-shrink-0 flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" /> Export
                    </button>
                    {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') && (
                        <button onClick={() => generatePdf(null, true)} className="btn-secondary flex-shrink-0 flex items-center justify-center gap-2">
                            <Printer className="w-4 h-4" /> Blank Print
                        </button>
                    )}
                    <button onClick={resetForm} className="btn-secondary flex-shrink-0 flex items-center justify-center gap-2">
                        <X className="w-4 h-4" /> Clear
                    </button>
                </div>
            </div>

            {statusMessage.text && (
                <div className={`px-4 py-3 rounded-xl text-sm font-bold animate-in fade-in slide-in-from-top-4 ${
                    statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                    {statusMessage.text}
                </div>
            )}

            {/* Form Section */}
            {(currentEntryId || isNewEntry) && (
                <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase">
                                {isNewEntry ? 'Create New Entry' : 'Update Entry'} - Token: {tokenNo}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${isNewEntry ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
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

                    <form onSubmit={handleSaveOrUpdateEntry} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Billing Date</label>
                            <input type="date" className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={billingDate} onChange={(e) => setBillingDate(e.target.value)} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Item Name</label>
                            <input type="text" className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={itemName} onChange={(e) => setItemName(e.target.value.toUpperCase())} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Farmer Name</label>
                            <input type="text" className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={Name} onChange={(e) => setName(e.target.value.toUpperCase())} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Farmer Phone Number</label>
                            <input 
                                type="text" 
                                className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                value={farmerPhone} 
                                onChange={handlePhoneChange} 
                                placeholder="10-DIGIT MOBILE NO" 
                                disabled={hasTareWtBeenEntered && !isNewEntry}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Village</label>
                            <input type="text" className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={Village} onChange={(e) => setVillage(e.target.value.toUpperCase())} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Vehicle No</label>
                            <input 
                                type="text" 
                                className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                value={vehicleNo} 
                                onChange={handleVehicleChange} 
                                required 
                                disabled={hasTareWtBeenEntered && !isNewEntry}
                                placeholder="MH-26-BS-4852"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Gross Weight (kg)</label>
                            <input type="number" step="0.01" className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Tare Weight (kg)</label>
                            <input type="number" step="0.01" className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={tareWt} onChange={(e) => setTareWt(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Moisture (%)</label>
                            <input type="number" step="0.1" className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="E.G., 8.5" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Rate (₹ per Quintal)</label>
                            <input type="number" step="0.01" className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={rate} onChange={(e) => setRate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Amount Paid (₹)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    value={amountPaid} 
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setAmountPaid(val);
                                        if (parseFloat(val || 0) > originalAmountPaid) {
                                            if (paymentMode === 'CASH') {
                                                setAccountantName(currentUser.name);
                                                setMakerName('');
                                            } else {
                                                setMakerName(currentUser.name);
                                                setAccountantName('');
                                            }
                                        }
                                    }} 
                                />
                                <button 
                                    type="button"
                                    onClick={() => {
                                        const parsedGrossWt = parseFloat(grossWt || 0);
                                        const parsedTareWt = parseFloat(tareWt || 0);
                                        const parsedRate = parseFloat(rate || 0);
                                        if (parsedGrossWt && parsedTareWt && parsedRate) {
                                            const netWt = parsedGrossWt - parsedTareWt;
                                            const parsedHamaliRate = parseFloat(hamaliRate || 0);
                                            const parsedWeighmentRate = parseFloat(weighmentRate || 0);
                                            const parsedGeneralDeductionPercent = parseFloat(generalDeductionPercent || 0);
                                                
                                            const deductionRate = parsedGeneralDeductionPercent / 100;
                                            const netWtAfterDeduction = netWt * (1 - deductionRate);
                                            const netWtInQuintals = netWt / 100;
                                            const hamaliDeduction = netWtInQuintals * parsedHamaliRate;
                                            const weighmentDeduction = netWtInQuintals * parsedWeighmentRate;
                                            const grossAmount = (parsedRate / 100) * netWtAfterDeduction;
                                            const netAmount = Math.round(grossAmount - hamaliDeduction - weighmentDeduction);
                                            setAmountPaid(netAmount.toString());
                                            
                                            if (netAmount > originalAmountPaid) {
                                                if (paymentMode === 'CASH') {
                                                    setAccountantName(currentUser.name);
                                                    setMakerName('');
                                                } else {
                                                    setMakerName(currentUser.name);
                                                    setAccountantName('');
                                                }
                                            }
                                        }
                                    }}
                                    className="px-3 py-2 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-lg hover:bg-indigo-200 transition-colors uppercase whitespace-nowrap"
                                >
                                    Full Pay
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Hamali Rate (₹/Quintal)</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                value={hamaliRate} 
                                onChange={(e) => setHamaliRate(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Weighment Rate (₹/Quintal)</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                value={weighmentRate} 
                                onChange={(e) => setWeighmentRate(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">General Deduction (%)</label>
                            <input 
                                type="number" 
                                step="any" 
                                className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                value={generalDeductionPercent} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val.endsWith('.')) {
                                        setGeneralDeductionPercent(val);
                                    } else {
                                        const parsed = parseFloat(val);
                                        setGeneralDeductionPercent(isNaN(parsed) ? '' : parsed);
                                    }
                                }} 
                                required 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Mode of Payment</label>
                            <select className="input-field uppercase" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                                <option value="CASH">CASH</option>
                                <option value="RTGS">RTGS</option>
                                <option value="DELAYED">DELAYED PAYMENT</option>
                            </select>
                        </div>
                        {paymentMode === 'DELAYED' && (
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Payment Due Date / Maturity</label>
                                <input 
                                    type="date" 
                                    className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    value={paymentDueDate} 
                                    onChange={(e) => setPaymentDueDate(e.target.value)} 
                                    required 
                                />
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Accountant / Maker</label>
                            <input 
                                type="text" 
                                className="input-field bg-slate-50 dark:bg-slate-800 uppercase" 
                                value={parseFloat(amountPaid) > 0 ? (paymentMode === 'CASH' ? accountantName : makerName) : ''} 
                                readOnly 
                                disabled 
                                placeholder="AUTO-FILLED ON PAYMENT"
                            />
                        </div>

                        {/* Installment History and Addition for Existing Entries */}
                        {!isNewEntry && tokenNo && (
                            <div className="lg:col-span-3 border-t border-slate-200 dark:border-slate-800 pt-6 mt-4 space-y-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h4 className="text-md font-bold text-slate-950 dark:text-white uppercase font-mono">Installment Payment History</h4>
                                        <p className="text-xs text-slate-500 uppercase">Manage multi-installment payments for Token {tokenNo}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50 flex items-center gap-6">
                                        <div className="text-center">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Total Paid</p>
                                            <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">₹{totalPaidSoFar.toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                                        <div className="text-center">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Live Balance</p>
                                            <p className="text-sm font-black text-red-500 dark:text-red-400">₹{currentLiveBalance.toLocaleString('en-IN')}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Installment List ledger */}
                                    <div className="lg:col-span-2 space-y-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payments Ledger</p>
                                        <div className="border border-slate-100 dark:border-slate-800/50 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/50 max-h-[180px] overflow-y-auto">
                                            {paymentHistory.length > 0 ? (
                                                paymentHistory.map((item, index) => (
                                                    <div key={index} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full uppercase text-[10px]">
                                                                {item.type || 'CASH'}
                                                            </span>
                                                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold font-mono">{item.date}</span>
                                                        </div>
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">₹{parseFloat(item.amount || 0).toLocaleString('en-IN')}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-slate-400 dark:text-slate-500 text-xs italic text-center py-6">No previous installments found. Add one below!</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Record New Installment Action Form */}
                                    <div className="bg-slate-50 dark:bg-slate-800/20 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Record New Installment</p>
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Amount (₹)</label>
                                                <input 
                                                    type="number" 
                                                    className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                                    placeholder="Enter installment amount..."
                                                    value={installmentLogAmount}
                                                    onChange={(e) => setInstallmentLogAmount(e.target.value)}
                                                    max={currentLiveBalance}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Mode</label>
                                                <select 
                                                    className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                                    value={installmentLogMode}
                                                    onChange={(e) => setInstallmentLogMode(e.target.value)}
                                                >
                                                    <option value="CASH">CASH</option>
                                                    <option value="RTGS">RTGS</option>
                                                </select>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    handleAddInstallmentLog(tokenNo, installmentLogAmount, installmentLogMode);
                                                    setInstallmentLogAmount('');
                                                }}
                                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl tracking-wider uppercase transition-colors"
                                            >
                                                Add Installment
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="lg:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button type="button" onClick={resetForm} className="btn-secondary uppercase">Cancel</button>
                            <button type="submit" className="btn-primary flex items-center gap-2 uppercase">
                                <Save className="w-4 h-4" /> {isNewEntry ? 'Save Entry' : 'Update Entry'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Export Modal */}
            <AnimatePresence>
                {showExportModal && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase">Export Reports</h3>
                                <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                                        <input 
                                            type="date" 
                                            className="input-field" 
                                            value={dateRange.start}
                                            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase">End Date</label>
                                        <input 
                                            type="date" 
                                            className="input-field" 
                                            value={dateRange.end}
                                            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <button 
                                        onClick={() => exportToExcel(true)}
                                        disabled={!dateRange.start || !dateRange.end}
                                        className="w-full btn-primary flex items-center justify-center gap-2 uppercase"
                                    >
                                        <Download className="w-4 h-4" /> Export Range (Excel)
                                    </button>
                                    <button 
                                        onClick={() => exportToExcel(false)}
                                        className="w-full btn-secondary flex items-center justify-center gap-2 uppercase"
                                    >
                                        <Download className="w-4 h-4" /> Export All (Excel)
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Table Section */}
            <div className="card overflow-hidden !p-0">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Recent Incoming Entries</h3>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                        Total: {filteredEntries.length} Entries
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="table-header">
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">Token</th>
                                <th className="px-6 py-4 font-semibold">Farmer</th>
                                <th className="px-6 py-4 font-semibold">Net Wt</th>
                                <th className="px-6 py-4 font-semibold">Net Amount</th>
                                <th className="px-6 py-4 font-semibold">Balance</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredEntries.map(entry => (
                                <tr key={entry.id} className="table-row group">
                                    <td className="px-6 py-4 text-sm uppercase">{entry.billingDate}</td>
                                    <td className="px-6 py-4 text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">{entry.tokenNo}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <div className="font-medium text-slate-900 dark:text-slate-200 uppercase">{entry.Name}</div>
                                        <div className="text-xs text-slate-400 uppercase">{entry.Village}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium uppercase">{entry.netWt || 0} kg</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">₹{(entry.netAmount || 0).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${entry.balanceAmount > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                                            ₹{(entry.balanceAmount || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2 items-center">
                                        {entry.farmerPhone && (
                                            <button 
                                                onClick={() => sharePattiToWhatsApp(entry)}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 uppercase"
                                                title="Share Patti via WhatsApp"
                                            >
                                                <Share2 className="w-3.5 h-3.5" />
                                                <span>Share Patti</span>
                                            </button>
                                        )}
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
                                                    className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700 transition-colors uppercase"
                                                >
                                                    Confirm
                                                </button>
                                                <button 
                                                    onClick={() => setDeleteConfirmId(null)}
                                                    className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-300 transition-colors uppercase"
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

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredEntries.map(entry => (
                        <div key={entry.id} className="p-4 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{entry.billingDate}</p>
                                    <h4 className="text-lg font-black text-indigo-600 dark:text-indigo-400 uppercase">{entry.tokenNo}</h4>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => generatePdf(entry)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                                        <FileText className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => setDeleteConfirmId(entry.tokenNo || entry.id)} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Farmer</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">{entry.Name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">{entry.Village}</p>
                                    {entry.farmerPhone && (
                                        <button 
                                            onClick={() => sharePattiToWhatsApp(entry)}
                                            className="mt-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold rounded flex items-center gap-1 uppercase tracking-wider"
                                        >
                                            <Share2 className="w-3 h-3" />
                                            <span>Share Patti</span>
                                        </button>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Net Weight</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">{entry.netWt || 0} KG</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Net Amount</p>
                                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase">₹{(entry.netAmount || 0).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Balance</p>
                                    <span className={`text-sm font-black uppercase ${entry.balanceAmount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        ₹{(entry.balanceAmount || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Aavak;
