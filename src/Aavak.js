import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, limit, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Search, Plus, FileText, Download, Save, X, Trash2, Copy, Printer, History, Settings, Share2, Users, CheckSquare, Square, FileSpreadsheet } from 'lucide-react';
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
    const [customItemName, setCustomItemName] = useState('');
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

    const [isRtgsModalOpen, setIsRtgsModalOpen] = useState(false);
    const [rtgsDetails, setRtgsDetails] = useState({
        bankName: '',
        accountNumber: '',
        accountHolderName: '',
        ifscCode: '',
        phoneNo: ''
    });


    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
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
    const [printEntry, setPrintEntry] = useState(null);

    const [isBulkExportOpen, setIsBulkExportOpen] = useState(false);
    const [bulkSearchQuery, setBulkSearchQuery] = useState('');
    const [selectedBulkIds, setSelectedBulkIds] = useState(new Set());
    const [bulkPrintEntries, setBulkPrintEntries] = useState(null);

    const commodityOptions = ['KAPAS', 'SOYABEAN', 'CHANA', 'TUAAR', 'WHEAT'];

    const formatVehicleNoInput = (val) => {
        const cleaned = val.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleaned.length <= 2) return cleaned;
        if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
        if (cleaned.length <= 6) return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 10)}`;
    };

    useEffect(() => {
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

        setFilteredEntries(result);
    }, [globalSearch, entries]);

    const handleSelectEntry = (entry) => {
        setCurrentEntryId(entry.id);
        setTokenNo(entry.tokenNo || '');
        setBillingDate(entry.billingDate || '');
        setName(entry.Name || '');
        setFarmerPhone(entry.farmerPhone || '');
        setVillage(entry.Village || '');
        setVehicleNo(entry.vehicleNo || '');
        const selectedItem = entry.itemName || 'KAPAS';
        if (commodityOptions.includes(selectedItem)) {
            setItemName(selectedItem);
            setCustomItemName('');
        } else {
            setItemName('OTHER_PRODUCTS');
            setCustomItemName(selectedItem);
        }
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
        setRtgsDetails(entry.rtgsDetails || {
            bankName: '',
            accountNumber: '',
            accountHolderName: '',
            ifscCode: '',
            phoneNo: ''
        });
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
        if (isBlank) {
            setPrintEntry({
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
            });
        } else {
            setPrintEntry(entryToPrint);
        }
        setTimeout(() => {
            window.print();
        }, 150);
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

    const handlePaymentModeChange = (newMode) => {
        setPaymentMode(newMode);
        if (newMode === 'RTGS') {
            setIsRtgsModalOpen(true);
        }
    };

    const handleRtgsDetailChange = (field, value) => {
        setRtgsDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        if (!isNewEntry && !currentEntryId) return;

        if (paymentMode === 'RTGS') {
            const { bankName, accountNumber, accountHolderName, ifscCode, phoneNo } = rtgsDetails;
            if (!bankName || !accountNumber || !accountHolderName || !ifscCode || !phoneNo) {
                setStatusMessage({ text: 'Please fill all RTGS bank details before saving', type: 'error' });
                setIsRtgsModalOpen(true);
                return;
            }
        }

        setStatusMessage({ text: 'Saving...', type: 'info' });

        const resolvedItemName = itemName === 'OTHER_PRODUCTS' ? customItemName.trim().toUpperCase() : itemName;

        const dataPayload = {
            billingDate: billingDate || null,
            tokenNo: tokenNo ? tokenNo.toUpperCase() : null,
            itemName: resolvedItemName || 'KAPAS',
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
            rtgsDetails: paymentMode === 'RTGS' ? {
                bankName: rtgsDetails.bankName ? rtgsDetails.bankName.toUpperCase() : '',
                accountNumber: rtgsDetails.accountNumber || '',
                accountHolderName: rtgsDetails.accountHolderName ? rtgsDetails.accountHolderName.toUpperCase() : '',
                ifscCode: rtgsDetails.ifscCode ? rtgsDetails.ifscCode.toUpperCase() : '',
                phoneNo: rtgsDetails.phoneNo || ''
            } : null,
            amountPaid: amountPaid !== '' ? parseFloat(amountPaid) : null,
            balanceAmount: balanceAmount !== '' ? parseFloat(balanceAmount) : null,
            accountantName: (accountantName || currentUser?.name || 'Authorized Client').toUpperCase(),
            updatedAt: serverTimestamp()
        };

        try {
            if (isNewEntry) {
                // Doc ID format: [Token No.] - [Amount Paid]
                const sanitize = (val) => String(val || '').trim().replace(/[\/\.\#\$\[\]]/g, '-');
                const tokenPart = sanitize(dataPayload.tokenNo) || 'TOKEN';
                const amountPart = sanitize(dataPayload.amountPaid ?? 0) || '0';
                const docId = `${tokenPart}-${amountPart}`;

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
            console.error(error);
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
            console.error(error);
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
            "Bank Name": entry.rtgsDetails?.bankName || '',
            "Account Number": entry.rtgsDetails?.accountNumber || '',
            "Account Holder": entry.rtgsDetails?.accountHolderName || '',
            "IFSC Code": entry.rtgsDetails?.ifscCode || '',
            "RTGS Phone No": entry.rtgsDetails?.phoneNo || '',
            "Operator": entry.accountantName || entry.makerName || ''
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Aavak Reports");
        XLSX.writeFile(workbook, `Aavak_Export_${new Date().toLocaleDateString('en-CA')}.xlsx`);
    };

    const bulkFilteredEntries = entries.filter(e => {
        if (!bulkSearchQuery) return true;
        const q = bulkSearchQuery.toLowerCase();
        return (e.Village && e.Village.toLowerCase().includes(q)) || (e.Name && e.Name.toLowerCase().includes(q));
    });

    const toggleBulkSelect = (id) => {
        setSelectedBulkIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAllBulk = () => {
        setSelectedBulkIds(prev => {
            const allSelected = bulkFilteredEntries.length > 0 && bulkFilteredEntries.every(e => prev.has(e.id));
            if (allSelected) return new Set();
            return new Set(bulkFilteredEntries.map(e => e.id));
        });
    };

    const getSelectedBulkEntries = () => entries.filter(e => selectedBulkIds.has(e.id));

    const closeBulkExport = () => {
        setIsBulkExportOpen(false);
        setBulkSearchQuery('');
        setSelectedBulkIds(new Set());
    };

    const handleBulkExportExcel = () => {
        const selected = getSelectedBulkEntries();
        if (selected.length === 0) {
            setStatusMessage({ text: 'Select at least one patti to export', type: 'error' });
            return;
        }
        const rows = selected.map(entry => ({
            "Date": entry.billingDate || '',
            "Token No": entry.tokenNo || '',
            "Farmer Name": entry.Name || '',
            "Village": entry.Village || '',
            "Net Wt (kg)": entry.netWtAfterDeduction || entry.netWt || '',
            "Net Amount": entry.netAmount || ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Selected Pattis");
        XLSX.writeFile(workbook, `Aavak_Group_Export_${new Date().toLocaleDateString('en-CA')}.xlsx`);
    };

    const handleBulkExportPdf = () => {
        const selected = getSelectedBulkEntries();
        if (selected.length === 0) {
            setStatusMessage({ text: 'Select at least one patti to export', type: 'error' });
            return;
        }
        setBulkPrintEntries(selected);
        setTimeout(() => {
            window.print();
        }, 150);
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
        setCustomItemName('');
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
        setRtgsDetails({
            bankName: '',
            accountNumber: '',
            accountHolderName: '',
            ifscCode: '',
            phoneNo: ''
        });
        setIsRtgsModalOpen(false);
        setIsNewEntry(false);
    };

    useEffect(() => {
        const clearPrintEntry = () => setPrintEntry(null);
        window.addEventListener('afterprint', clearPrintEntry);
        return () => window.removeEventListener('afterprint', clearPrintEntry);
    }, []);

    useEffect(() => {
        const clearBulkPrintEntries = () => setBulkPrintEntries(null);
        window.addEventListener('afterprint', clearBulkPrintEntries);
        return () => window.removeEventListener('afterprint', clearBulkPrintEntries);
    }, []);

    const printableAavak = printEntry;

    return (
        <div className="space-y-6">
            <style>{`
                @media screen {
                    .vcc-print-sheet, .vcc-bulk-report { display: none !important; }
                }
                @media print {
                    .vcc-bulk-report {
                        display: block !important;
                        visibility: visible !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 210mm !important;
                        padding: 10mm !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-family: 'Helvetica Neue', Arial, sans-serif !important;
                    }
                    .vcc-bulk-report * { visibility: visible !important; }
                    .vcc-bulk-report table { width: 100% !important; border-collapse: collapse !important; }
                    .vcc-bulk-report th, .vcc-bulk-report td {
                        border: 1px solid #000 !important;
                        padding: 5px 8px !important;
                        font-size: 10px !important;
                        text-align: left !important;
                    }
                    .vcc-bulk-report th { background: #f1f5f9 !important; font-weight: 700 !important; }
                    @page { size: A4; margin: 0; }
                    html, body {
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: 297mm !important;
                        max-height: 297mm !important;
                        overflow: hidden !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body * { visibility: hidden !important; }
                    .vcc-print-sheet, .vcc-print-sheet * { visibility: visible !important; }
                    .vcc-print-sheet {
                        display: flex !important;
                        flex-direction: column !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        max-height: 297mm !important;
                        box-sizing: border-box !important;
                        overflow: hidden !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-family: 'Helvetica Neue', Arial, sans-serif !important;
                        font-size: 11px !important;
                    }
                    .slip {
                        flex: 1 !important;
                        padding: 10px 15px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        position: relative !important;
                        box-sizing: border-box !important;
                    }
                    .cut-line {
                        height: 1px !important;
                        border-top: 1px dashed #000 !important;
                        width: 100% !important;
                        text-align: center !important;
                        position: relative !important;
                        margin: 2px 0 !important;
                        box-sizing: border-box !important;
                    }
                    .cut-line span {
                        position: absolute !important;
                        top: -10px !important;
                        left: 50% !important;
                        transform: translateX(-50%) !important;
                        background: #fff !important;
                        padding: 0 10px !important;
                        font-size: 10px !important;
                        font-weight: 700 !important;
                    }
                    .header-table {
                        width: 100% !important;
                        margin-bottom: 8px !important;
                    }
                    .metadata-grid {
                        display: grid !important;
                        grid-template-columns: repeat(3, 1fr) !important;
                        gap: 4px !important;
                        margin-bottom: 8px !important;
                        padding: 6px !important;
                        border: 1px solid #000 !important;
                    }
                    .main-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        margin-bottom: 8px !important;
                    }
                    .main-table th, .main-table td {
                        border: 1px solid #000 !important;
                        padding: 3px 6px !important;
                        text-align: left !important;
                    }
                    .main-table th {
                        background-color: #f8fafc !important;
                        font-weight: 700 !important;
                    }
                    .summary-block {
                        display: flex !important;
                        justify-content: flex-end !important;
                        margin-bottom: 10px !important;
                    }
                    .summary-inner {
                        width: 220px !important;
                        border: 1px solid #000 !important;
                        border-top: none !important;
                    }
                    .summary-row {
                        display: flex !important;
                        justify-content: space-between !important;
                        padding: 3px 6px !important;
                        border-top: 1px solid #000 !important;
                    }
                    .summary-row strong {
                        font-size: 12px !important;
                    }
                    .footer-block {
                        margin-top: auto !important;
                        display: flex !important;
                        justify-content: space-between !important;
                        align-items: flex-end !important;
                        padding-top: 10px !important;
                    }
                    .footer-line {
                        width: 160px !important;
                        border-top: 1px solid #000 !important;
                        text-align: center !important;
                        padding-top: 2px !important;
                        font-size: 10px !important;
                        text-transform: uppercase !important;
                    }
                    .label-tag {
                        position: absolute !important;
                        top: 10px !important;
                        right: 15px !important;
                        border: 1px solid #000 !important;
                        padding: 2px 8px !important;
                        font-weight: 700 !important;
                        font-size: 10px !important;
                        background: #f1f5f9 !important;
                    }
                }
            `}</style>
            {printableAavak && (
                <div className="vcc-print-sheet text-black">
                    {['OFFICE COPY', 'FARMER COPY'].map((copyLabel, copyIndex) => {
                        const hamaliVal = (parseFloat(printableAavak.hamaliDeduction || 0) + parseFloat(printableAavak.weighmentDeduction || 0)).toFixed(2);
                        const dedPercent = printableAavak.generalDeductionPercentage !== undefined ? printableAavak.generalDeductionPercentage : (printableAavak.generalDeductionPercent !== undefined ? printableAavak.generalDeductionPercent : 1.4);
                        return (
                            <React.Fragment key={copyLabel}>
                                <div className="slip">
                                    <div className="label-tag">{copyLabel}</div>
                                    <table className="header-table">
                                        <tbody>
                                            <tr>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '1px' }}>VENKATESH COTTON COMPANY</div>
                                                    <div style={{ fontSize: '10px', marginTop: '2px' }}>NH752, Pomnala, Maharashtra 431801 | Mob: +91 9876543210</div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div className="metadata-grid">
                                        <div><strong>Token No:</strong> {printableAavak.tokenNo || ''}</div>
                                        <div><strong>Date:</strong> {printableAavak.billingDate || ''}</div>
                                        <div><strong>Farmer:</strong> {printableAavak.Name || ''}</div>
                                        <div><strong>Vehicle No:</strong> {printableAavak.vehicleNo || ''}</div>
                                        <div><strong>Village:</strong> {printableAavak.Village || ''}</div>
                                        <div><strong>Item Name:</strong> {printableAavak.itemName || ''}</div>
                                    </div>
                                    <table className="main-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '50%' }}>Description</th>
                                                <th style={{ width: '25%' }}>Weight / Rate</th>
                                                <th style={{ width: '25%' }}>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>Gross Weight / Tare Weight</td>
                                                <td>{printableAavak.grossWt || 0} kg / {printableAavak.tareWt || 0} kg</td>
                                                <td>--</td>
                                            </tr>
                                            <tr>
                                                <td>Net Weight</td>
                                                <td>{printableAavak.netWt || 0} kg</td>
                                                <td>--</td>
                                            </tr>
                                            <tr>
                                                <td>Net Wt (After {dedPercent}% Ded.)</td>
                                                <td>{printableAavak.netWtAfterDeduction || printableAavak.netWt || 0} kg</td>
                                                <td>--</td>
                                            </tr>
                                            <tr>
                                                <td>Rate / Hamali & Weighment</td>
                                                <td>{printableAavak.rate || 0} / {hamaliVal}</td>
                                                <td>-{hamaliVal}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div className="summary-block">
                                        <div className="summary-inner">
                                            <div className="summary-row">
                                                <span>NET PAYABLE</span>
                                                <strong>{printableAavak.netAmount || 0}</strong>
                                            </div>
                                            <div className="summary-row">
                                                <span>AMOUNT PAID</span>
                                                <strong>{printableAavak.amountPaid || 0}</strong>
                                            </div>
                                            <div className="summary-row">
                                                <span>BALANCE</span>
                                                <strong>{printableAavak.balanceAmount || 0}</strong>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="footer-block">
                                        <div><strong>Payment Mode:</strong> {printableAavak.paymentMode || ''}</div>
                                        <div className="footer-line">Farmer Signature</div>
                                        <div className="footer-line">Accountant</div>
                                    </div>
                                </div>
                                {copyIndex === 0 && (
                                    <div className="cut-line">
                                        <span>✂️------------------- CUT ALONG THIS LINE -------------------✂️</span>
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}
            {bulkPrintEntries && (
                <div className="vcc-bulk-report text-black">
                    <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '1px' }}>VENKATESH COTTON COMPANY</div>
                        <div style={{ fontSize: '10px', marginTop: '2px' }}>NH752, Pomnala, Maharashtra 431801 | Aavak Group Report — {new Date().toLocaleDateString('en-CA')}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Token</th>
                                <th>Farmer</th>
                                <th>Village</th>
                                <th>Net Wt (kg)</th>
                                <th>Net Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bulkPrintEntries.map(entry => (
                                <tr key={entry.id}>
                                    <td>{entry.billingDate}</td>
                                    <td>{entry.tokenNo}</td>
                                    <td>{entry.Name}</td>
                                    <td>{entry.Village}</td>
                                    <td>{entry.netWtAfterDeduction || entry.netWt}</td>
                                    <td>{entry.netAmount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
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
                        className="btn-primary flex items-center gap-2 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" /> New Inward Bill
                    </button>
                    <button onClick={() => setIsBulkExportOpen(true)} className="btn-secondary flex items-center gap-2 cursor-pointer">
                        <Users className="w-4 h-4" /> Group Export
                    </button>
                    <button onClick={handleExportToExcel} className="btn-secondary flex items-center gap-2 cursor-pointer">
                        <Download className="w-4 h-4" /> Export
                    </button>
                    {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') && (
                        <button onClick={() => generatePdf(null, true)} className="btn-secondary flex-shrink-0 flex items-center justify-center gap-2 cursor-pointer">
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
                                <button onClick={resetState} className="p-1 px-3 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg dark:text-white cursor-pointer">✕ Close Form</button>
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
                                            <option value="OTHER_PRODUCTS">Other Products</option>
                                        </select>
                                    </div>
                                    {itemName === 'OTHER_PRODUCTS' && (
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Custom Commodity *</label>
                                            <input type="text" className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} placeholder="Enter product name" required disabled={hasTareWtBeenEntered && !isNewEntry} />
                                        </div>
                                    )}
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
                                                <input type="number" step="0.01" className="input-field font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate " required />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Moisture %</label>
                                                <input type="number" step="0.1" className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="Moisture %" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Hamali (Quintal)</label>
                                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center font-bold text-slate-700 dark:text-slate-300">
                                                     {hamaliDeduction}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Weighment Charges</label>
                                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-center font-bold text-slate-700 dark:text-slate-300">
                                                     {weighmentDeduction}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 p-5 bg-emerald-50/40 dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-slate-700">
                                            <div>
                                                <span className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Gross Amount</span>
                                                <span className="text-sm font-black text-slate-800 dark:text-white"> {grossAmount || '0.00'}</span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Total Deductions</span>
                                                <span className="text-sm font-black text-red-600"> {(parseFloat(hamaliDeduction) + parseFloat(weighmentDeduction)).toFixed(2)}</span>
                                            </div>
                                            <div className="md:col-span-2 border-l border-slate-200 dark:border-slate-700 pl-5">
                                                <span className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Final Net Payable</span>
                                                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400"> {netAmount || '0.00'}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Payment Mode</label>
                                                <select className="input-field font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white" value={paymentMode} onChange={(e) => handlePaymentModeChange(e.target.value)}>
                                                    <option value="CASH">CASH</option>
                                                    <option value="RTGS">RTGS/UPI (ONLINE)</option>
                                                    <option value="CHEQUE">CHEQUE</option>
                                                    <option value="CREDIT">CREDIT (DUE)</option>
                                                </select>
                                                {paymentMode === 'RTGS' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsRtgsModalOpen(true)}
                                                        className="mt-2 w-full text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg py-1.5 cursor-pointer"
                                                    >
                                                        {rtgsDetails.accountNumber ? `Bank: ${rtgsDetails.bankName || '—'} (Edit)` : 'Enter Bank Details'}
                                                    </button>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Amount Paid Today * </label>
                                                <input type="number" step="0.01" className="input-field font-bold text-indigo-600 dark:text-blue-400 dark:bg-slate-800 dark:border-slate-700" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" required />
                                            </div>
                                            <div>
                                                <div className="p-3 bg-red-50/50 dark:bg-red-950/10 rounded-lg text-center">
                                                    <span className="block text-[8px] text-red-400 uppercase font-bold mb-1">Balance Unpaid</span>
                                                    <span className="text-base font-black text-red-600"> {balanceAmount || '0.00'}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Billing Accountant</label>
                                                <input type="text" className="input-field uppercase font-bold dark:bg-slate-800 dark:border-slate-700" value={accountantName} onChange={(e) => setAccountantName(e.target.value)} placeholder={currentUser?.name || "Officer"} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-4 border-t border-slate-150 dark:border-slate-800">
                                    <button type="submit" className="p-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 uppercase tracking-wider text-white text-xs font-black shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer">
                                        <Save className="w-4 h-4" /> Save Purchase Record
                                    </button>
                                    <button type="button" onClick={resetState} className="p-3 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white uppercase tracking-wider text-xs font-black cursor-pointer">
                                        Cancel change
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Historical Transactions</h3>
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    className="input-field pl-9 text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    placeholder="Search farmer, village, vehicle or token..."
                                    value={globalSearch}
                                    onChange={(e) => setGlobalSearch(e.target.value)}
                                />
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
                                                    <div className="text-[10px] text-slate-400">{entry.itemName} @ {entry.rate}/qtl</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                                                         {entry.amountPaid} <span className="text-[10px] text-slate-400">/   {entry.netAmount}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            parseFloat(entry.balanceAmount || 0) <= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-red-50 text-red-600 dark:bg-red-950/20'
                                                        }`}>
                                                            {parseFloat(entry.balanceAmount || 0) <= 0 ? 'PAID' : `DUE:  ${entry.balanceAmount}`}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 uppercase tracking-widest">{entry.paymentMode}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button 
                                                            onClick={() => { setPrintEntry(entry); setTimeout(() => window.print(), 50); }}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                                            title="Print"
                                                        >
                                                            <FileText className="w-5 h-5" />
                                                        </button>
                                                        
                                                        {parseFloat(entry.balanceAmount || 0) > 0 && (
                                                            <button 
                                                                onClick={() => setPaymentHistoryEntry(entry)}
                                                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-xl mr-1 cursor-pointer"
                                                            >
                                                                Installments
                                                            </button>
                                                        )}

                                                        <button 
                                                            onClick={() => handleSelectEntry(entry)}
                                                            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors text-xs font-bold uppercase cursor-pointer"
                                                        >
                                                            Edit
                                                        </button>
                                                        
                                                        {(currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN') && (
                                                            <button 
                                                                onClick={() => setDeleteConfirmId(entry.id)}
                                                                className="p-2 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
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
                                <button onClick={() => setSearchToken('')} className="text-xs text-red-500 font-bold uppercase cursor-pointer">Clear</button>
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
                                            <button onClick={() => { setPrintEntry(entry); setTimeout(() => window.print(), 50); }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer">
                                                <FileText className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => setDeleteConfirmId(entry.tokenNo || entry.id)} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 cursor-pointer">
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
                {isRtgsModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 max-w-md w-full p-6 rounded-2xl shadow-xl space-y-5">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
                                <div className="space-y-0.5">
                                    <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">RTGS / Bank Details</h4>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Required for online payment settlement</p>
                                </div>
                                <button onClick={() => setIsRtgsModalOpen(false)} className="p-1 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs rounded-lg dark:text-white cursor-pointer">✕</button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Bank Name *</label>
                                    <input
                                        type="text"
                                        className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        placeholder="e.g. STATE BANK OF INDIA"
                                        value={rtgsDetails.bankName}
                                        onChange={(e) => handleRtgsDetailChange('bankName', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Account Number *</label>
                                    <input
                                        type="text"
                                        className="input-field font-mono dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        placeholder="e.g. 123456789012"
                                        value={rtgsDetails.accountNumber}
                                        onChange={(e) => handleRtgsDetailChange('accountNumber', e.target.value.replace(/[^0-9]/g, ''))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Account Holder Name *</label>
                                    <input
                                        type="text"
                                        className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        placeholder="As per bank passbook"
                                        value={rtgsDetails.accountHolderName}
                                        onChange={(e) => handleRtgsDetailChange('accountHolderName', e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">IFSC Code *</label>
                                        <input
                                            type="text"
                                            className="input-field uppercase font-mono dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            placeholder="e.g. SBIN0001234"
                                            value={rtgsDetails.ifscCode}
                                            onChange={(e) => handleRtgsDetailChange('ifscCode', e.target.value.toUpperCase())}
                                            maxLength={11}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Phone No *</label>
                                        <input
                                            type="text"
                                            className="input-field font-mono dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            placeholder="e.g. 9876543210"
                                            value={rtgsDetails.phoneNo}
                                            onChange={(e) => handleRtgsDetailChange('phoneNo', e.target.value.replace(/[^0-9]/g, ''))}
                                            maxLength={10}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsRtgsModalOpen(false)}
                                    className="flex-1 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 uppercase tracking-wider text-white text-xs font-black shadow-lg shadow-indigo-100 dark:shadow-none cursor-pointer"
                                >
                                    Save Bank Details
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setPaymentMode('CASH'); setIsRtgsModalOpen(false); }}
                                    className="p-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white uppercase tracking-wider text-xs font-black cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {isBulkExportOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 max-w-2xl w-full p-6 rounded-2xl shadow-xl space-y-5">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
                                <div className="space-y-0.5">
                                    <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Group Export — Pattis</h4>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Search by Village or Farmer Name, select pattis, then export</p>
                                </div>
                                <button onClick={closeBulkExport} className="p-1 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs rounded-lg dark:text-white cursor-pointer">✕</button>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    className="input-field pl-9 uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    placeholder="Search Village or Farmer Name..."
                                    value={bulkSearchQuery}
                                    onChange={(e) => setBulkSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                                <button onClick={toggleSelectAllBulk} className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 cursor-pointer">
                                    {bulkFilteredEntries.length > 0 && bulkFilteredEntries.every(e => selectedBulkIds.has(e.id)) ? (
                                        <CheckSquare className="w-4 h-4" />
                                    ) : (
                                        <Square className="w-4 h-4" />
                                    )}
                                    Select All ({bulkFilteredEntries.length})
                                </button>
                                <span>{selectedBulkIds.size} Selected</span>
                            </div>

                            <div className="max-h-72 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                                {bulkFilteredEntries.length === 0 ? (
                                    <div className="text-center p-8 text-xs font-semibold text-slate-400 uppercase">No pattis match this search</div>
                                ) : (
                                    bulkFilteredEntries.map(entry => (
                                        <label key={entry.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                                checked={selectedBulkIds.has(entry.id)}
                                                onChange={() => toggleBulkSelect(entry.id)}
                                            />
                                            <div className="flex-1 flex items-center justify-between text-xs">
                                                <div>
                                                    <div className="font-extrabold text-slate-900 dark:text-white">{entry.Name} <span className="text-slate-400 font-mono">#{entry.tokenNo}</span></div>
                                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">{entry.Village} | {entry.billingDate}</div>
                                                </div>
                                                <div className="text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                                                    {entry.netWtAfterDeduction || entry.netWt} kg
                                                </div>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleBulkExportExcel}
                                    className="flex-1 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 uppercase tracking-wider text-white text-xs font-black shadow-lg shadow-emerald-100 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <FileSpreadsheet className="w-4 h-4" /> Export Excel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBulkExportPdf}
                                    className="flex-1 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 uppercase tracking-wider text-white text-xs font-black shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Printer className="w-4 h-4" /> Export PDF
                                </button>
                                <button
                                    type="button"
                                    onClick={closeBulkExport}
                                    className="p-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white uppercase tracking-wider text-xs font-black cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {deleteConfirmId && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-slate-900 max-w-sm w-full p-6 rounded-2xl shadow-xl text-center space-y-4">
                            <h4 className="font-extrabold text-slate-900 dark:text-white uppercase text-base">Confirm Deletion</h4>
                            <p className="text-xs text-slate-500">Are you sure you want to permanently delete this Aavak Purchase Ledger?</p>
                            <div className="flex items-center justify-center gap-3 pt-2">
                                <button onClick={() => handleDeleteEntry(deleteConfirmId)} className="p-2.5 px-6 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl uppercase tracking-wider shadow-md shadow-red-200 dark:shadow-none cursor-pointer">Delete</button>
                                <button onClick={() => setDeleteConfirmId(null)} className="p-2.5 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-white font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer">Cancel</button>
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
                                <button onClick={() => setPaymentHistoryEntry(null)} className="p-1 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs rounded-lg dark:text-white cursor-pointer">✕</button>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Net Bill Amount</p>
                                    <p className="text-sm font-black text-slate-900 dark:text-white"> {paymentHistoryEntry.netAmount}</p>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Paid till Date</p>
                                    <p className="text-sm font-black text-emerald-600"> {paymentHistoryEntry.amountPaid}</p>
                                </div>
                                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl text-center">
                                    <p className="text-[8px] font-bold text-red-400 uppercase tracking-widest mb-1">Outstanding Liability</p>
                                    <p className="text-sm font-black text-red-600"> {paymentHistoryEntry.balanceAmount}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Transaction Ledger</h5>
                                <div className="max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/10 flex justify-between items-center text-xs font-semibold">
                                        <span className="text-slate-400">Advance/Initial Bill Payment</span>
                                        <span className="text-slate-900 dark:text-white font-mono font-bold"> {paymentHistoryEntry.netAmount - paymentHistoryEntry.balanceAmount - (paymentHistoryEntry.installmentLogs || []).reduce((acc, pay) => acc + (pay.amount || 0), 0)}</span>
                                    </div>
                                    {(paymentHistoryEntry.installmentLogs || []).map((install, idx) => (
                                        <div key={idx} className="p-3 flex justify-between items-center text-xs">
                                            <div className="space-y-0.5">
                                                <p className="font-bold text-slate-900 dark:text-white font-mono"> {install.amount}</p>
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
                                            <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs"> </span>
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
                                            className="px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-emerald-200 dark:shadow-none cursor-pointer"
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