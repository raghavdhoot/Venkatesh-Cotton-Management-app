import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, limit, serverTimestamp, setDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { IndianRupee, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, History, Wallet, Lock, Unlock } from 'lucide-react';

const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getTodayDateStr = () => {
    return formatDate(new Date());
};


function CashManagement({ currentUser }) {
    const [transactions, setTransactions] = useState([]);
    const [type, setType] = useState('OUT');
    const [amount, setAmount] = useState('');
    const [recipient, setRecipient] = useState('');
    const [reason, setReason] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
    const [sourceSelect, setSourceSelect] = useState('SBI');
    const [customSource, setCustomSource] = useState('');
    const [openingBalance, setOpeningBalance] = useState(0);
    const [todayClosure, setTodayClosure] = useState(null);

    const isAuthorized = currentUser?.role?.toUpperCase() === 'ADMIN' || 
                       currentUser?.employeeId === 'ADMIN' || 
                       currentUser?.role?.toUpperCase() === 'CASHIER';

    useEffect(() => {
        if (!isAuthorized) return;
        const q = query(collection(db, 'cashTransactions'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [isAuthorized]);

    useEffect(() => {
        if (!isAuthorized) return;
        const todayStr = getTodayDateStr();

        // Listen for today's closure
        const unsubToday = onSnapshot(doc(db, 'dailyClosures', `Closure-${todayStr}`), (docSnap) => {
            if (docSnap.exists()) {
                setTodayClosure({ id: docSnap.id, ...docSnap.data() });
            } else {
                setTodayClosure(null);
            }
        });

        // Fetch the most recent daily closure to set opening balance automatically
        const q = query(collection(db, "dailyClosures"), orderBy("createdAt", "desc"), limit(1));
        const unsubLatestClosure = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const lastClosureDoc = snapshot.docs[0].data();
                setOpeningBalance(lastClosureDoc.closingBalance || lastClosureDoc.expectedClosingBalance || 0);
            } else {
                // Try querying with 'timestamp' descending as fallback for older documents
                const qFallback = query(collection(db, "dailyClosures"), orderBy("timestamp", "desc"), limit(1));
                getDocs(qFallback).then(fallbackSnapshot => {
                    if (!fallbackSnapshot.empty) {
                        const lastDoc = fallbackSnapshot.docs[0].data();
                        setOpeningBalance(lastDoc.closingBalance || lastDoc.expectedClosingBalance || 0);
                    } else {
                        setOpeningBalance(0);
                    }
                }).catch(() => {
                    setOpeningBalance(0);
                });
            }
        }, (error) => {
            console.error("Error fetching latest closure on mount:", error);
            setOpeningBalance(0);
        });

        return () => {
            unsubToday();
            unsubLatestClosure();
        };
    }, [isAuthorized]);

    useEffect(() => {
        if (statusMessage.text) {
            const timer = setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount) return;

        if (type === 'OUT' && !reason.trim()) {
            setStatusMessage({ text: 'Reason is strictly required for Cash Out transactions', type: 'error' });
            return;
        }

        try {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // Count existing records for this specific day to determine the next serial number
            const querySnapshot = await getDocs(collection(db, 'cashTransactions'));
            const todayEntries = querySnapshot.docs.filter(docVal => docVal.id.includes(dateStr));
            const count = todayEntries.length;

            const nextSrNo = count + 1;
            const srNo = String(nextSrNo).padStart(2, '0');

            let customIdSuffix = '';
            if (type === 'IN') {
                if (sourceSelect === 'SBI' || sourceSelect === 'Rajesh') {
                    customIdSuffix = sourceSelect;
                } else {
                    const cleanCustom = customSource.trim().replace(/\s+/g, '');
                    const cleanReason = reason.trim().replace(/\s+/g, '');
                    customIdSuffix = cleanReason || cleanCustom || 'Other';
                }
            } else {
                customIdSuffix = reason.trim().replace(/\s+/g, '');
            }

            const customId = `${srNo}-${dateStr}-${amount}-${customIdSuffix}`;

            const finalSource = type === 'IN'
                ? (sourceSelect === 'Other' ? (customSource.trim() || 'Other') : sourceSelect)
                : 'N/A';

            const finalReason = reason.trim() 
                ? reason.toUpperCase() 
                : (type === 'IN' ? `CASH IN FROM ${finalSource.toUpperCase()}` : 'N/A');

            await setDoc(doc(db, 'cashTransactions', customId), {
                type,
                amount: parseFloat(amount),
                source: finalSource.toUpperCase(),
                recipient: type === 'OUT' ? (recipient.toUpperCase() || 'N/A') : 'N/A',
                reason: finalReason,
                recordedBy: currentUser.name,
                timestamp: serverTimestamp()
            });

            setStatusMessage({ text: 'Transaction recorded!', type: 'success' });
            resetForm();
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error adding transaction:", error);
            setStatusMessage({ text: 'Error recording transaction', type: 'error' });
        }
    };

    const resetForm = () => {
        setAmount('');
        setRecipient('');
        setReason('');
        setType('OUT');
        setSourceSelect('SBI');
        setCustomSource('');
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this transaction?')) return;
        try {
            await deleteDoc(doc(db, 'cashTransactions', id));
            setStatusMessage({ text: 'Transaction deleted', type: 'success' });
        } catch (error) {
            console.error("Error deleting:", error);
            setStatusMessage({ text: 'Error deleting', type: 'error' });
        }
    };

    const totalIn = transactions.filter(t => t.type === 'IN').reduce((acc, t) => acc + (parseFloat(t.amount || t.amountPaid || 0) || 0), 0);
    const totalOut = transactions.filter(t => t.type !== 'IN').reduce((acc, t) => acc + (parseFloat(t.amount || t.amountPaid || 0) || 0), 0);
    const balance = totalIn - totalOut;

    const todayStr = getTodayDateStr();

    const todayTransactions = transactions.filter(t => {
        if (t.id && t.id.includes(todayStr)) return true;
        if (t.timestamp) {
            try {
                const date = t.timestamp.toDate();
                return formatDate(date) === todayStr;
            } catch (e) {
                return false;
            }
        }
        return false;
    });

    const todayIn = todayTransactions
        .filter(t => t.type === 'IN')
        .reduce((acc, t) => acc + (parseFloat(t.amount || t.amountPaid || 0) || 0), 0);
    const todayOut = todayTransactions
        .filter(t => t.type !== 'IN')
        .reduce((acc, t) => acc + (parseFloat(t.amount || t.amountPaid || 0) || 0), 0);

    const expectedClosingBalance = (parseFloat(openingBalance) || 0) + todayIn - todayOut;

    const handleCloseCounter = async () => {
        if (!window.confirm(`Are you sure you want to CLOSE the counter for today (${todayStr})? This will lock today's cash entries.`)) return;

        try {
            const docId = `Closure-${todayStr}`;
            await setDoc(doc(db, 'dailyClosures', docId), {
                date: todayStr,
                openingBalance: parseFloat(openingBalance) || 0,
                totalCashIn: parseFloat(todayIn) || 0,
                totalCashOut: parseFloat(todayOut) || 0,
                expectedClosingBalance: parseFloat(expectedClosingBalance) || 0,
                closingBalance: parseFloat(expectedClosingBalance) || 0,
                closedBy: currentUser?.name || 'ADMIN',
                timestamp: serverTimestamp(),
                createdAt: serverTimestamp()
            });

            setStatusMessage({ text: 'Counter closed successfully!', type: 'success' });
        } catch (error) {
            console.error("Error closing counter:", error);
            setStatusMessage({ text: 'Error closing counter', type: 'error' });
        }
    };

    if (!isAuthorized) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                        <IndianRupee className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Access Denied</h2>
                    <p className="text-slate-500 dark:text-slate-400">Only Cashiers and Admins can access Cash Management.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cash Management</h2>
                <div className="flex items-center gap-4">
                    {statusMessage.text && (
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-right-4 ${
                            statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                            {statusMessage.text}
                        </div>
                    )}
                    <button 
                        onClick={() => setIsFormOpen(!isFormOpen)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        {isFormOpen ? 'Close Form' : 'Record Transaction'}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg">
                            <ArrowDownCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Total Cash In</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">₹{totalIn.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                <div className="card bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-800 rounded-lg">
                            <ArrowUpCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">Total Cash Out</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">₹{totalOut.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                <div className="card bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-lg">
                            <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Current Balance</p>
                            <p className="text-xl font-black text-slate-900 dark:text-white">₹{balance.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {isFormOpen && (
                <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold mb-6 text-slate-800 dark:text-slate-100 uppercase tracking-tight">Record New Transaction</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Transaction Type</label>
                            <select 
                                className="input-field font-bold uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                            >
                                <option value="OUT">CASH OUT (PAYMENT/EXPENSE)</option>
                                <option value="IN">CASH IN (FROM BANK/ADMIN)</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Amount (₹)</label>
                            <input 
                                type="number"
                                className="input-field font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                            />
                        </div>
                        {type === 'IN' ? (
                            <>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Source (Select)</label>
                                    <select
                                        className="input-field font-bold uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        value={sourceSelect}
                                        onChange={(e) => setSourceSelect(e.target.value)}
                                    >
                                        <option value="SBI">SBI</option>
                                        <option value="Rajesh">RAJESH</option>
                                        <option value="Other">OTHER</option>
                                    </select>
                                </div>
                                {sourceSelect === 'Other' && (
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Custom Source Name</label>
                                        <input 
                                            type="text"
                                            className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            placeholder="E.G. HDFC BANK, CASH DRAWER"
                                            value={customSource}
                                            onChange={(e) => setCustomSource(e.target.value)}
                                            required
                                        />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Recipient (To)</label>
                                <input 
                                    type="text"
                                    className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    placeholder="E.G. FARMER NAME, STAFF"
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="md:col-span-2 lg:col-span-3 space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                                Reason / Description {type === 'OUT' ? <span className="text-red-500">*</span> : <span className="text-slate-400 text-xs font-normal">(Optional)</span>}
                            </label>
                            <input 
                                type="text"
                                className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                placeholder={type === 'OUT' ? "E.G. TRANSPORT WORKERS, OFFICE STATIONERY" : "E.G. BANK WITHDRAWAL, LOAN REPAYMENT (OPTIONAL)"}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required={type === 'OUT'}
                            />
                        </div>
                        <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="btn-secondary">Cancel</button>
                            <button type="submit" className="btn-primary">Save Transaction</button>
                        </div>
                    </form>
                </div>
            )}

            {/* EOD Drawer Closure Section */}
            <div className="card bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${todayClosure ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'}`}>
                            {todayClosure ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                                End of Day (EOD) Drawer Closure
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {todayClosure ? `Counter for today (${todayStr}) is successfully locked.` : `Daily counter balance verification for today (${todayStr}).`}
                            </p>
                        </div>
                    </div>

                    {!todayClosure && (
                        <button 
                            onClick={handleCloseCounter}
                            className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm"
                        >
                            <Lock className="w-4 h-4" />
                            Close Counter for Today
                        </button>
                    )}
                </div>

                {todayClosure ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 text-center md:text-left">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opening Balance</span>
                            <p className="text-base font-black text-slate-800 dark:text-slate-100">₹{(todayClosure.openingBalance || 0).toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 text-center md:text-left">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cash In</span>
                            <p className="text-base font-black text-emerald-600 dark:text-emerald-400">₹{(todayClosure.totalCashIn || 0).toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 text-center md:text-left">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cash Out</span>
                            <p className="text-base font-black text-red-600 dark:text-red-400">₹{(todayClosure.totalCashOut || 0).toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 text-center md:text-left">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Closing Balance</span>
                            <p className="text-base font-black text-slate-800 dark:text-slate-100">₹{(todayClosure.expectedClosingBalance || 0).toLocaleString()}</p>
                        </div>
                        <div className="col-span-2 md:col-span-1 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 text-center md:text-left flex flex-col justify-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Closed By</span>
                            <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{todayClosure.closedBy}</p>
                            <p className="text-[9px] text-slate-400 uppercase truncate">
                                {todayClosure.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50 flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Opening Balance <span className="text-emerald-500 font-extrabold">(Automated)</span>
                            </span>
                            <div className="flex items-center gap-1">
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">₹</span>
                                <input 
                                    type="number"
                                    className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 font-extrabold text-sm text-slate-800 dark:text-slate-100 focus:outline-none"
                                    value={openingBalance}
                                    readOnly
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800/50">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Inflow</span>
                            <p className="text-base font-black text-emerald-600 dark:text-emerald-400 pt-1">₹{todayIn.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800/50">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Outflow</span>
                            <p className="text-base font-black text-red-600 dark:text-red-400 pt-1">₹{todayOut.toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800/50">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expected Close</span>
                            <p className="text-base font-black text-slate-800 dark:text-slate-100 pt-1">₹{expectedClosingBalance.toLocaleString()}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* History Table */}
            <div className="card !p-0 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Transaction History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                                <th className="px-6 py-4 font-bold">Date & Time</th>
                                <th className="px-6 py-4 font-bold">Type</th>
                                <th className="px-6 py-4 font-bold">Details</th>
                                <th className="px-6 py-4 font-bold">Reason</th>
                                <th className="px-6 py-4 font-bold text-right">Amount</th>
                                <th className="px-6 py-4 font-bold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {transactions.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                                        {t.timestamp?.toDate().toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                            t.type === 'IN' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                            {t.type === 'IN' ? 'IN' : 'OUT'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                                            {t.type === 'IN' ? `From: ${t.source}` : `To: ${t.recipient}`}
                                        </p>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">By: {t.recordedBy}</p>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 uppercase font-medium">
                                        {t.reason}
                                    </td>
                                    <td className={`px-6 py-4 text-sm font-black text-right ${t.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {t.type === 'IN' ? '+' : '-'}₹{(parseFloat(t.amount || t.amountPaid || 0) || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => handleDelete(t.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic text-sm">
                                        No transactions recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default CashManagement;
