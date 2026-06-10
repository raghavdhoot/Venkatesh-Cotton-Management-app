import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, limit, serverTimestamp, getDocs, doc, getDoc, updateDoc, setDoc, deleteDoc, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Search, Plus, FileText, Download, Save, X, Trash2, Copy, Printer, History, Settings, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeItemName } from './utils/normalization';
import { subscribeToAavak } from './components/Dashboard';

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
    const [netWt, setNetWt] = useState('');
    const [rate, setRate] = useState('');
    const [moisture, setMoisture] = useState('');
    const [generalDeductionPercent, setGeneralDeductionPercent] = useState('');
    const [netWtAfterDeduction, setNetWtAfterDeduction] = useState('');
    const [grossAmount, setGrossAmount] = useState('');
    const [hamaliDeduction, setHamaliDeduction] = useState(0);
    const [weighmentDeduction, setWeighmentDeduction] = useState(1);
    const [netAmount, setNetAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('CASH');
    const [amountPaid, setAmountPaid] = useState('');
    const [balanceAmount, setBalanceAmount] = useState('');
    const [accountantName, setAccountantName] = useState('');
    
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [billingSettings, setBillingSettings] = useState({
        generalDeductionPercent: 1.4,
        hamaliPerQuintal: 4.5,
        weighmentCharges: 10
    });
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [paymentLogValue, setPaymentLogValue] = useState('');
    const [paymentHistoryEntry, setPaymentHistoryEntry] = useState(null);

    const formatVehicleNoInput = (val) => {
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
            const q = query(collection(db, 'cottonEntries'), where('billingDate', '<', dateStr));
            const snapshot = await getDocs(q);
            snapshot.forEach(async (docRef) => {
                await deleteDoc(doc(db, 'cottonEntries', docRef.id));
            });
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        runCleanupAfterSevenDays();
        
        const unsubscribe = subscribeToAavak((data) => {
            setEntries(data);
        });

        const settingsDocRef = doc(db, 'settings', 'billing');
        getDoc(settingsDocRef).then((snap) => {
            if (snap.exists()) {
                setBillingSettings(snap.data());
            } else {
                setDoc(settingsDocRef, billingSettings);
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        let result = entries;

        if (globalSearch) {
            const queryLower = globalSearch.toLowerCase();
            result = result.filter(e => 
                (e.tokenNo && e.tokenNo.toLowerCase().includes(queryLower)) ||
                (e.Name && e.Name.toLowerCase().includes(queryLower)) ||
                (e.Village && e.Village.toLowerCase().includes(queryLower)) ||
                (e.vehicleNo && e.vehicleNo.toLowerCase().includes(queryLower)) ||
                (e.itemName && e.itemName.toLowerCase().includes(queryLower))
            );
        }

        if (dateRange.start && dateRange.end) {
            result = result.filter(e => e.billingDate >= dateRange.start && e.billingDate <= dateRange.end);
        }

        setFilteredEntries(result);
    }, [globalSearch, dateRange, entries]);

    const handleSelectEntry = (entry) => {
        setCurrentEntryId(entry.id);
        setTokenNo(entry.tokenNo || '');
        setBillingDate(entry.billingDate || '');
        setName(entry.Name || '');
        setFarmerPhone(entry.farmerPhone || '');
        setVillage(entry.Village || '');
        setVehicleNo(entry.vehicleNo || '');
        setItemName(entry.itemName || 'KAPAS');
        setGrossWt(entry.grossWt || '');
        setTareWt(entry.tareWt || '');
        setNetWt(entry.netWt || '');
        setRate(entry.rate || '');
        setMoisture(entry.moisture || '');
        setGeneralDeductionPercent(entry.generalDeductionPercentage !== undefined ? entry.generalDeductionPercentage : (entry.generalDeductionPercent !== undefined ? entry.generalDeductionPercent : ''));
        setNetWtAfterDeduction(entry.netWtAfterDeduction || '');
        setGrossAmount(entry.grossAmount || '');
        setHamaliDeduction(entry.hamaliDeduction || 0);
        setWeighmentDeduction(entry.weighmentDeduction || 1);
        setNetAmount(entry.netAmount || '');
        setPaymentMode(entry.paymentMode || 'CASH');
        setAmountPaid(entry.amountPaid || '');
        setBalanceAmount(entry.balanceAmount || '');
        setAccountantName(entry.accountantName || entry.makerName || '');
        setIsNewEntry(false);
    };

    const handleSavePaymentLog = async () => {
        if (!paymentHistoryEntry || !paymentLogValue || isNaN(paymentLogValue)) return;
        const toPay = parseFloat(paymentLogValue);
        const currentBalance = parseFloat(paymentHistoryEntry.balanceAmount || 0);

        if (toPay <= 0) {
            setStatusMessage({ text: 'Please enter a valid amount', type: 'error' });
            return;
        }

        if (toPay > currentBalance) {
            setStatusMessage({ text: 'Amount exceeds remaining balance', type: 'error' });
            return;
        }

        const newPaid = parseFloat(paymentHistoryEntry.amountPaid || 0) + toPay;
        const newBalance = currentBalance - toPay;

        const newLog = {
            amount: toPay,
            date: new Date().toLocaleDateString('en-CA'),
            time: new Date().toLocaleTimeString(),
            operator: currentUser?.name || 'Staff'
        };

        const existingLogs = paymentHistoryEntry.installmentLogs || [];

        try {
            await updateDoc(doc(db, 'cottonEntries', paymentHistoryEntry.id), {
                amountPaid: parseFloat(newPaid.toFixed(2)),
                balanceAmount: parseFloat(newBalance.toFixed(2)),
                installmentLogs: [...existingLogs, newLog],
                updatedAt: serverTimestamp()
            });
            setStatusMessage({ text: 'Installment saved successfully!', type: 'success' });
            setPaymentLogValue('');
            const updatedDoc = await getDoc(doc(db, 'cottonEntries', paymentHistoryEntry.id));
            if (updatedDoc.exists()) {
                setPaymentHistoryEntry({ id: updatedDoc.id, ...updatedDoc.data() });
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

    const hasTareWtBeenEntered = tareWt !== '' && tareWt !== null && parseFloat(tareWt) > 0;

    const parsedGrossWtForCalc = parseFloat(grossWt || 0);
    const parsedTareWtForCalc = parseFloat(tareWt || 0);

    useEffect(() => {
        if (parsedGrossWtForCalc > 0 && parsedTareWtForCalc > 0) {
            const calculatedNet = Math.max(0, parsedGrossWtForCalc - parsedTareWtForCalc);
            setNetWt(calculatedNet);
        } else {
            setNetWt('');
        }
    }, [parsedGrossWtForCalc, parsedTareWtForCalc]);

    const finalDeductionPercent = generalDeductionPercent !== '' && generalDeductionPercent !== null ? parseFloat(generalDeductionPercent) : billingSettings.generalDeductionPercent;

    useEffect(() => {
        const parsedNetWt = parseFloat(netWt || 0);
        if (parsedNetWt > 0) {
            const deductionKg = parsedNetWt * (finalDeductionPercent / 100);
            const wtAfterDed = Math.max(0, parsedNetWt - deductionKg);
            setNetWtAfterDeduction(parseFloat(wtAfterDed.toFixed(2)));
        } else {
            setNetWtAfterDeduction('');
        }
    }, [netWt, finalDeductionPercent, billingSettings.generalDeductionPercent]);

    const parsedRate = parseFloat(rate || 0);
    const parsedNetWtAfterDed = parseFloat(netWtAfterDeduction || 0);

    useEffect(() => {
        if (parsedRate > 0 && parsedNetWtAfterDed > 0) {
            const grossAmt = (parsedNetWtAfterDed / 100) * parsedRate;
            setGrossAmount(parseFloat(grossAmt.toFixed(2)));
        } else {
            setGrossAmount('');
        }
    }, [parsedRate, parsedNetWtAfterDed]);

    useEffect(() => {
        const parsedGrossAmt = parseFloat(grossAmount || 0);
        const parsedNetWt = parseFloat(netWt || 0);
        if (parsedGrossAmt > 0 && parsedNetWt > 0) {
            const hamali = (parsedNetWt / 100) * billingSettings.hamaliPerQuintal;
            const weighment = billingSettings.weighmentCharges;
            setHamaliDeduction(parseFloat(hamali.toFixed(2)));
            setWeighmentDeduction(parseFloat(weighment.toFixed(2)));
            const netAmt = parsedGrossAmt - hamali - weighment;
            setNetAmount(parseFloat(netAmt.toFixed(2)));
        } else {
            setHamaliDeduction(0);
            setWeighmentDeduction(0);
            setNetAmount('');
        }
    }, [grossAmount, netWt, billingSettings]);

    const parsedNetAmount = parseFloat(netAmount || 0);
    const parsedAmountPaid = parseFloat(amountPaid || 0);

    useEffect(() => {
        if (parsedNetAmount > 0) {
            const bal = parsedNetAmount - parsedAmountPaid;
            setBalanceAmount(parseFloat(bal.toFixed(2)));
        } else {
            setBalanceAmount('');
        }
    }, [parsedNetAmount, parsedAmountPaid]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        if (!isNewEntry && !currentEntryId) return;

        setStatusMessage({ text: 'Saving...', type: 'info' });

        const dataPayload = {
            billingDate: billingDate || null,
            tokenNo: tokenNo ? tokenNo.toUpperCase() : null,
            itemName: itemName || 'KAPAS',
            Name: Name ? Name.toUpperCase() : null,
            farmerPhone: farmerPhone || '',
            Village: Village ? Village.toUpperCase() : null,
            vehicleNo: vehicleNo ? formatVehicleNoInput(vehicleNo) : null,
            grossWt: grossWt !== '' ? parseFloat(grossWt) : null,
            tareWt: tareWt !== '' ? parseFloat(tareWt) : null,
            netWt: netWt !== '' ? parseFloat(netWt) : null,
            rate: rate !== '' ? parseFloat(rate) : null,
            moisture: moisture !== '' ? parseFloat(moisture) : null,
            generalDeductionPercentage: generalDeductionPercent !== '' ? parseFloat(generalDeductionPercent) : billingSettings.generalDeductionPercent,
            netWtAfterDeduction: netWtAfterDeduction !== '' ? parseFloat(netWtAfterDeduction) : null,
            grossAmount: grossAmount !== '' ? parseFloat(grossAmount) : null,
            hamaliDeduction: parseFloat(hamaliDeduction),
            weighmentDeduction: parseFloat(weighmentDeduction),
            netAmount: netAmount !== '' ? parseFloat(netAmount) : null,
            paymentMode: paymentMode,
            amountPaid: amountPaid !== '' ? parseFloat(amountPaid) : null,
            balanceAmount: balanceAmount !== '' ? parseFloat(balanceAmount) : null,
            accountantName: (accountantName || currentUser?.name || 'Authorized Client').toUpperCase(),
            updatedAt: serverTimestamp()
        };

        try {
            if (isNewEntry) {
                const docId = `aavak_${Date.now()}`;
                await setDoc(doc(db, 'cottonEntries', docId), {
                    ...dataPayload,
                    makerId: currentUser?.employeeId || 'ADMIN',
                    makerName: currentUser?.name || 'ADMIN',
                    createdAt: serverTimestamp(),
                    installmentLogs: []
                });
                setStatusMessage({ text: 'Created successfully!', type: 'success' });
                resetState();
            } else {
                await updateDoc(doc(db, 'cottonEntries', currentEntryId), dataPayload);
                setStatusMessage({ text: 'Updated successfully!', type: 'success' });
            }
        } catch (error) {
            console.error("Error creating/updating in cottonEntries collection: ", error);
            setStatusMessage({ text: 'Internal database error.', type: 'error' });
        }
    };

    const handleDeleteEntry = async (id) => {
        try {
            await deleteDoc(doc(db, 'cottonEntries', id));
            setStatusMessage({ text: 'Deleted Entry', type: 'success' });
            setDeleteConfirmId(null);
            resetState();
        } catch (error) {
            console.error("Error deleting document from cottonEntries collection:", error);
            setStatusMessage({ text: 'Error deleting.', type: 'error' });
        }
    };

    const handleExportToExcel = () => {
        const rows = filteredEntries.map(entry => ({
            "Token No": entry.tokenNo || '',
            "Date": entry.billingDate || '',
            "Farmer Name": entry.Name || '',
            "Village": entry.Village || '',
            "Vehicle No": entry.vehicleNo || '',
            "Item": entry.itemName || '',
            "Gross Weight": entry.grossWt || '',
            "Tare Weight": entry.tareWt || '',
            "Net Weight": entry.netWt || '',
            "Rate": entry.rate || '',
            "Net Amount": entry.netAmount || '',
            "Amount Paid": entry.amountPaid || '',
            "Balance": entry.balanceAmount || '',
            "Payment Mode": entry.paymentMode || '',
            "Operator": entry.accountantName || entry.makerName || ''
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Aavak Reports");
        XLSX.writeFile(workbook, `Aavak_Export_${new Date().toLocaleDateString('en-CA')}.xlsx`);
    };

    const resetState = () => {
        setCurrentEntryId(null);
        setTokenNo('');
        setBillingDate(new Date().toISOString().split('T')[0]);
        setName('');
        setFarmerPhone('');
        setVillage('');
        setVehicleNo('');
        setItemName('KAPAS');
        setGrossWt('');
        setTareWt('');
        setNetWt('');
        setRate('');
        setMoisture('');
        setGeneralDeductionPercent('');
        setNetWtAfterDeduction('');
        setGrossAmount('');
        setHamaliDeduction(0);
        setWeighmentDeduction(1);
        setNetAmount('');
        setPaymentMode('CASH');
        setAmountPaid('');
        setBalanceAmount('');
        setAccountantName('');
        setIsNewEntry(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-xl">
                        A
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Aavak Entry Desk</h1>
                        <p className="text-xs text-slate-500">Inward Cotton Purchase, Weight and Complete Payment Bills</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button 
                        onClick={() => { resetState(); setIsNewEntry(true); }} 
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> New Inward Bill
                    </button>
                    <button onClick={handleExportToExcel} className="btn-secondary flex items-center gap-2">
                        <Download className="w-4 h-4" /> Export
                    </button>
                    {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') && (
                        <button onClick={() => generatePdf(null, true)} className="btn-secondary flex-shrink-0 flex items-center justify-center gap-2">
                            <Printer className="w-4 h-4" /> Blank Print
                        </button>
                    )}
                </div>
            </div>

            {statusMessage.text && (
                <div className={`p-4 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-between ${
                    statusMessage.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' :
                    statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' :
                    'bg-blue-50 text-indigo-600 dark:bg-slate-800'
                }`}>
                    <span>{statusMessage.text}</span>
                    <button onClick={() => setStatusMessage({ text: '', type: '' })} className="font-bold">✕</button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-6">
                    {(isNewEntry || currentEntryId) && (
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }} 
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                                    {isNewEntry ? 'Create Inward purchase bill' : 'Update Record Inward bill'}
                                </h3>
                                <button onClick={resetState} className="p-1 px-3 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg dark:text-white">✕ Close Form</button>
                            </div>

                            <form onSubmit={handleFormSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Billing Date</label>
                                        <input type="date" className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={billingDate} onChange={(e) => setBillingDate(e.target.value)} required disabled={hasTareWtBeenEntered && !isNewEntry} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Token No *</label>
                                        <input type="text" className="input-field uppercase font-mono dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={tokenNo} onChange={(e) => setTokenNo(e.target.value)} placeholder="T-100" required disabled={hasTareWtBeenEntered && !isNewEntry} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Item / Commodity</label>
                                        <select className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={itemName} onChange={(e) => setItemName(e.target.value)} disabled={hasTareWtBeenEntered && !isNewEntry}>
                                            <option value="KAPAS">KAPAS (COTTON)</option>
                                            <option value="SOYABEAN">SOYABEAN</option>
                                            <option value="CHANA">CHANA</option>
                                            <option value="TUAAR">TUAAR</option>
                                            <option value="WHEAT">WHEAT (GEHU)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Farmer Name *</label>
                                        <input type="text" className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={Name} onChange={(e) => setName(e.target.value)} placeholder="Enter Farmer's name" required disabled={hasTareWtBeenEntered && !isNewEntry} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Farmer Phone</label>
                                        <input type="text" className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={farmerPhone} onChange={(e) => setFarmerPhone(e.target.value)} placeholder="e.g. 9876543210" disabled={hasTareWtBeenEntered && !isNewEntry} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Village *</label>
                                        <input type="text" className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={Village} onChange={(e) => setVillage(e.target.value)} placeholder="Farmer Village" required disabled={hasTareWtBeenEntered && !isNewEntry} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 p-5 bg-indigo-50/40 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/50 dark:border-indigo-950/20">
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Vehicle No *</label>
                                        <input type="text" className="input-field uppercase font-mono dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={vehicleNo} onChange={(e) => setVehicleNo(formatVehicleNoInput(e.target.value))} placeholder="MH-26-H-1991" required disabled={hasTareWtBeenEntered && !isNewEntry} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Gross Weight * (kg)</label>
                                        <input type="number" step="0.01" className="input-field font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={grossWt} onChange={(e) => setGrossWt(e.target.value)} placeholder="e.g. 4500" required disabled={hasTareWtBeenEntered && !isNewEntry} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Tare Weight (kg)</label>
                                        <input type="number" step="0.01" className="input-field font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={tareWt} onChange={(e) => setTareWt(e.target.value)} placeholder="e.g. 1200" />
                                    </div>
                                </div>

                                {parseFloat(netWt) > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                        <div>
                                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                                                <span className="block text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-1">Net Weight</span>
                                                <span className="text-base font-black text-slate-800 dark:text-white">{netWt} kg</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">General Ded. %</label>
                                            <input type="number" step="0.1" className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={generalDeductionPercent} onChange={(e) => setGeneralDeductionPercent(e.target.value)} placeholder={`Default ${billingSettings.generalDeductionPercent}%`} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                                                <span className="block text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-1">Net Wt after Deduction</span>
                                                <span className="text-base font-black text-indigo-600 dark:text-blue-400">{netWtAfterDeduction || '0.00'} kg</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {parseFloat(netWtAfterDeduction) > 0 && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Purchase Rate * (per Qtl)</label>
                                                <input type="number" step="0.01" className="input-field font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate ₹" required />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Moisture %</label>
                                                <input type="number" step="0.1" className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="Moisture %" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Hamali (Quintal)</label>
                                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center font-bold text-slate-700 dark:text-slate-300">
                                                    ₹ {hamaliDeduction}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Weighment Charges</label>
                                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center font-bold text-slate-700 dark:text-slate-300">
                                                    ₹ {weighmentDeduction}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 p-5 bg-emerald-50/40 dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-slate-700">
                                            <div>
                                                <span className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Gross Amount</span>
                                                <span className="text-sm font-black text-slate-800 dark:text-white">₹ {grossAmount || '0.00'}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Total Deductions</span>
                                                <span className="text-sm font-black text-red-600">₹ {(parseFloat(hamaliDeduction) + parseFloat(weighmentDeduction)).toFixed(2)}</span>
                                            </div>
                                            <div className="md:col-span-2 border-l border-slate-200 dark:border-slate-700 pl-5">
                                                <span className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Final Net Payable</span>
                                                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">₹ {netAmount || '0.00'}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Payment Mode</label>
                                                <select className="input-field font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                                                    <option value="CASH">CASH</option>
                                                    <option value="RTGS">RTGS/UPI (ONLINE)</option>
                                                    <option value="CHEQUE">CHEQUE</option>
                                                    <option value="CREDIT">CREDIT (DUE)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Amount Paid Today * </label>
                                                <input type="number" step="0.01" className="input-field font-bold text-indigo-600 dark:text-blue-400 dark:bg-slate-800 dark:border-slate-700" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" required />
                                            </div>
                                            <div>
                                                <div className="p-3 bg-red-50/50 dark:bg-red-950/10 rounded-lg text-center">
                                                    <span className="block text-[8px] text-red-400 uppercase font-bold mb-1">Balance Unpaid</span>
                                                    <span className="text-base font-black text-red-600">₹ {balanceAmount || '0.00'}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Billing Accountant</label>
                                                <input type="text" className="input-field uppercase font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={accountantName} onChange={(e) => setAccountantName(e.target.value)} placeholder={currentUser?.name || "Officer"} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-4 border-t border-slate-150 dark:border-slate-800">
                                    <button type="submit" className="p-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 uppercase tracking-wider text-white text-xs font-black shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2">
                                        <Save className="w-4 h-4" /> Save Purchase Record
                                    </button>
                                    <button type="button" onClick={resetState} className="p-3 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white uppercase tracking-wider text-xs font-black">
                                        Cancel change
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Historical Transactions (7 days)</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Filter Range</span>
                                <input type="date" className="input-field text-xs px-2 py-1 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} />
                                <span className="text-xs text-slate-400">to</span>
                                <input type="date" className="input-field text-xs px-2 py-1 dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />
                                {(dateRange.start || dateRange.end) && (
                                    <button onClick={() => setDateRange({start: '', end: ''})} className="text-xs text-red-500 hover:underline">Clear</button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-6 py-4">Token No</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Farmer Details</th>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4">Net WT (After D)</th>
                                        <th className="px-6 py-4">Payment</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="text-center p-8 text-xs font-semibold text-slate-400 uppercase">No purchases found in registry</td>
                                        </tr>
                                    ) : (
                                        filteredEntries.map(entry => (
                                            <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                                                <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white text-sm">{entry.tokenNo}</td>
                                                <td className="px-6 py-4 text-sm uppercase">{entry.billingDate}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-extrabold text-slate-900 dark:text-white text-xs">{entry.Name}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">{entry.Village} {entry.farmerPhone && `| Mob ${entry.farmerPhone}`}</div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{entry.vehicleNo}</td>
                                                <td className="px-6 py-4 font-medium text-xs">
                                                    <span className="font-extrabold text-slate-900 dark:text-white">{entry.netWtAfterDeduction || entry.netWt} kg</span>
                                                    <div className="text-[10px] text-slate-400">{entry.itemName} @ ₹{entry.rate}/qtl</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                                                        ₹ {entry.amountPaid} <span className="text-[10px] text-slate-400">/ ₹ {entry.netAmount}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            parseFloat(entry.balanceAmount || 0) <= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-red-50 text-red-600 dark:bg-red-950/20'
                                                        }`}>
                                                            {parseFloat(entry.balanceAmount || 0) <= 0 ? 'PAID' : `DUE: ₹${entry.balanceAmount}`}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 uppercase tracking-widest">{entry.paymentMode}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button 
                                                            onClick={() => generatePdf(entry)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                                            title="Download PDF"
                                                        >
                                                            <FileText className="w-5 h-5" />
                                                        </button>
                                                        
                                                        {parseFloat(entry.balanceAmount || 0) > 0 && (
                                                            <button 
                                                                onClick={() => setPaymentHistoryEntry(entry)}
                                                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-xl mr-1"
                                                            >
                                                                Installments
                                                            </button>
                                                        )}

                                                        <button 
                                                            onClick={() => handleSelectEntry(entry)}
                                                            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors text-xs font-bold uppercase"
                                                        >
                                                            Edit
                                                        </button>
                                                        
                                                        {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') && (
                                                            <button 
                                                                onClick={() => setDeleteConfirmId(entry.id)}
                                                                className="p-2 text-slate-400 hover:text-red-600 transition-colors"
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

                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
                        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                            <Search className="w-5 h-5 text-slate-400" />
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Quick Verify Token</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="text" 
                                className="input-field uppercase font-mono dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                placeholder="ENTER TOKEN NO." 
                                value={searchToken}
                                onChange={(e) => setSearchToken(e.target.value)}
                            />
                            {searchToken && (
                                <button onClick={() => setSearchToken('')} className="text-xs text-red-500 font-bold uppercase">Clear</button>
                            )}
                        </div>

                        {searchToken && (
                            <div className="space-y-3 pt-3">
                                {entries.filter(e => e.tokenNo && e.tokenNo.toLowerCase() === searchToken.toLowerCase()).map(entry => (
                                    <div key={entry.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{entry.billingDate}</p>
                                            <h4 className="text-lg font-black text-indigo-600 dark:text-indigo-400 uppercase">{entry.tokenNo}</h4>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => generatePdf(entry)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                                                <FileText className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => setDeleteConfirmId(entry.tokenNo || entry.id)} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {deleteConfirmId && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-900 max-w-sm w-full p-6 rounded-2xl shadow-xl text-center space-y-4">
                            <h4 className="font-extrabold text-slate-900 dark:text-white uppercase text-base">Confirm Deletion</h4>
                            <p className="text-xs text-slate-500">Are you sure you want to permanently delete this Aavak Purchase Ledger?</p>
                            <div className="flex items-center justify-center gap-3 pt-2">
                                <button onClick={() => handleDeleteEntry(deleteConfirmId)} className="p-2.5 px-6 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl uppercase tracking-wider shadow-md shadow-red-200 dark:shadow-none">Delete</button>
                                <button onClick={() => setDeleteConfirmId(null)} className="p-2.5 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white font-bold text-xs rounded-xl uppercase tracking-wider">Cancel</button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {paymentHistoryEntry && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 max-w-xl w-full p-6 rounded-2xl shadow-xl space-y-6">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
                                <div className="space-y-0.5">
                                    <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Installment & Credit logs</h4>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Token: {paymentHistoryEntry.tokenNo} | Farmer: {paymentHistoryEntry.Name}</p>
                                </div>
                                <button onClick={() => setPaymentHistoryEntry(null)} className="p-1 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs rounded-lg dark:text-white">✕</button>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Net Bill Amount</p>
                                    <p className="text-sm font-black text-slate-900 dark:text-white">₹{paymentHistoryEntry.netAmount}</p>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Paid till Date</p>
                                    <p className="text-sm font-black text-emerald-600">₹{paymentHistoryEntry.amountPaid}</p>
                                </div>
                                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl text-center">
                                    <p className="text-[8px] font-bold text-red-400 uppercase tracking-widest mb-1">Outstanding Liability</p>
                                    <p className="text-sm font-black text-red-600">₹{paymentHistoryEntry.balanceAmount}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Transaction Ledger</h5>
                                <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/10 flex justify-between items-center text-xs font-semibold">
                                        <span className="text-slate-400">Advance/Initial Bill Payment</span>
                                        <span className="text-slate-900 dark:text-white font-mono font-bold">₹{paymentHistoryEntry.netAmount - paymentHistoryEntry.balanceAmount - (paymentHistoryEntry.installmentLogs || []).reduce((acc, pay) => acc + (pay.amount || 0), 0)}</span>
                                    </div>
                                    {(paymentHistoryEntry.installmentLogs || []).map((install, idx) => (
                                        <div key={idx} className="p-3 flex justify-between items-center text-xs">
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-slate-900 dark:text-white font-mono">₹{install.amount}</p>
                                                <p className="text-[9px] text-slate-400 font-medium">Logged by {install.operator} | {install.date} {install.time}</p>
                                            </div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-[#ef4444]">Installment</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {parseFloat(paymentHistoryEntry.balanceAmount) > 0 && (
                                <div className="space-y-3 pt-3 border-t border-slate-150 dark:border-slate-800">
                                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Log New Installment</h5>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">₹</span>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                placeholder="Amount to pay" 
                                                className="input-field pl-7 dark:bg-slate-800"
                                                value={paymentLogValue}
                                                onChange={(e) => setPaymentLogValue(e.target.value)}
                                            />
                                        </div>
                                        <button 
                                            onClick={handleSavePaymentLog} 
                                            className="px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-emerald-200 dark:shadow-none"
                                        >
                                            Submit Payment
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Aavak;