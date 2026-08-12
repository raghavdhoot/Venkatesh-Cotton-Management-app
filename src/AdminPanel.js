import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, doc, addDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { Save, Trash2, Plus, IndianRupee, Shield, Mail, Edit, X } from 'lucide-react';
import { normalizeItemName } from './utils/normalization';

function AdminPanel({ currentUser }) {
    const [note, setNote] = useState('');
    const [dashboardNotes, setDashboardNotes] = useState([]);
    const [itemName, setItemName] = useState('');
    const [itemRate, setItemRate] = useState('');
    const [rateChart, setRateChart] = useState([]);
    const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

    // Rate Edit States
    const [editingRateId, setEditingRateId] = useState(null);
    const [editingItemName, setEditingItemName] = useState('');
    const [editingItemRate, setEditingItemRate] = useState('');

    // Main Form Rate Edit States
    const [isEditingForm, setIsEditingForm] = useState(false);
    const [lastFetchedName, setLastFetchedName] = useState('');

    useEffect(() => {
        const checkRateObj = async () => {
            const trimmed = itemName.trim();
            if (!trimmed) {
                setIsEditingForm(false);
                setLastFetchedName('');
                return;
            }
            const commodityName = normalizeItemName(trimmed);

            if (commodityName === lastFetchedName) return;

            try {
                const docSnap = await getDoc(doc(db, 'rateCharts', commodityName));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setItemRate(data.rate.toString());
                    setIsEditingForm(true);
                    setLastFetchedName(commodityName);
                } else {
                    setIsEditingForm(false);
                    setLastFetchedName(commodityName);
                    if (isEditingForm) {
                        setItemRate('');
                    }
                }
            } catch (error) {
                console.error("Error checking rate:", error);
            }
        };

        const delayDebounceFn = setTimeout(() => {
            checkRateObj();
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [itemName, lastFetchedName, isEditingForm]);

    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.employeeId === 'ADMIN';

    useEffect(() => {
        if (!isAdmin) return;

        const unsubscribeNotes = onSnapshot(query(collection(db, 'adminNotes'), orderBy('timestamp', 'desc')), (snapshot) => {
            setDashboardNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubscribeRates = onSnapshot(query(collection(db, 'rateCharts'), orderBy('timestamp', 'desc')), (snapshot) => {
            const rates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRateChart(rates);
        });

        return () => {
            unsubscribeNotes();
            unsubscribeRates();
        };
    }, [isAdmin]);

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!note.trim()) return;
        try {
            await addDoc(collection(db, 'adminNotes'), {
                content: note.toUpperCase(),
                author: currentUser.name,
                timestamp: serverTimestamp()
            });
            setNote('');
            setStatusMessage({ text: 'Dashboard note added successfully', type: 'success' });
        } catch (error) {
            console.error("Error adding note:", error);
            setStatusMessage({ text: 'Error adding note', type: 'error' });
        }
    };

    const handleAddRate = async (e) => {
        e.preventDefault();
        if (!itemName.trim() || !itemRate) return;
        const commodityName = normalizeItemName(itemName);
        try {
            await setDoc(doc(db, 'rateCharts', commodityName), {
                itemName: commodityName,
                rate: parseFloat(itemRate),
                timestamp: serverTimestamp()
            });
            setItemName('');
            setItemRate('');
            setIsEditingForm(false);
            setLastFetchedName('');
            setStatusMessage({ 
                text: isEditingForm ? 'Rate updated successfully' : 'Rate added successfully', 
                type: 'success' 
            });
        } catch (error) {
            console.error("Error saving rate:", error);
            setStatusMessage({ 
                text: isEditingForm ? 'Error updating rate' : 'Error adding rate', 
                type: 'error' 
            });
        }
    };

    const handleDelete = async (coll, id) => {
        try {
            await deleteDoc(doc(db, coll, id));
            setStatusMessage({ text: 'Deleted successfully', type: 'success' });
            setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
        } catch (error) {
            console.error("Error deleting:", error);
            setStatusMessage({ text: 'Error deleting', type: 'error' });
            setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
        }
    };

    const startEditing = (rate) => {
        setEditingRateId(rate.id);
        setEditingItemName(rate.itemName);
        setEditingItemRate(rate.rate.toString());
    };

    const cancelEditing = () => {
        setEditingRateId(null);
        setEditingItemName('');
        setEditingItemRate('');
    };

    const handleUpdateRate = async (oldId) => {
        if (!editingItemName.trim() || !editingItemRate) return;
        const commodityName = normalizeItemName(editingItemName);
        try {
            // If the document ID changed (due to renaming), delete the old one first
            if (oldId !== commodityName) {
                await deleteDoc(doc(db, 'rateCharts', oldId));
            }
            await setDoc(doc(db, 'rateCharts', commodityName), {
                itemName: commodityName,
                rate: parseFloat(editingItemRate),
                timestamp: serverTimestamp()
            });
            setEditingRateId(null);
            setEditingItemName('');
            setEditingItemRate('');
            setStatusMessage({ text: 'Rate updated successfully', type: 'success' });
            setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
        } catch (error) {
            console.error("Error updating rate:", error);
            setStatusMessage({ text: 'Error updating rate', type: 'error' });
            setTimeout(() => setStatusMessage({ text: '', type: '' }), 3000);
        }
    };

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center space-y-4">
                    <Shield className="w-16 h-16 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Access Denied</h2>
                    <p className="text-slate-500 dark:text-slate-400">Only administrators can access this panel.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Control Panel</h2>
                {statusMessage.text && (
                    <div className={`px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-right-4 ${
                        statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {statusMessage.text}
                    </div>
                )}
            </div>



            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Dashboard Notes Management */}
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-600" />
                            Dashboard Notes (Public)
                        </h3>
                        <form onSubmit={handleAddNote} className="space-y-4">
                            <textarea 
                                className="input-field min-h-[80px] uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                placeholder="ENTER PUBLIC ANNOUNCEMENT..."
                                value={note}
                                onChange={(e) => setNote(e.target.value.toUpperCase())}
                                required
                            />
                            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" /> Post Note
                            </button>
                        </form>
                    </div>

                    <div className="card !p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">Recent Dashboard Notes</h4>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                            {dashboardNotes.length > 0 ? (
                                dashboardNotes.map(n => (
                                    <div key={n.id} className="p-4 flex justify-between items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-900 dark:text-slate-100 font-medium whitespace-pre-wrap">{n.content}</p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 uppercase">By {n.author} • {n.timestamp?.toDate().toLocaleString()}</p>
                                        </div>
                                        <button onClick={() => handleDelete('adminNotes', n.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 dark:text-slate-500 italic text-sm">No notes posted yet.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Rate Chart Management */}
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <IndianRupee className="w-5 h-5 text-emerald-600" />
                            Manage Rate Chart
                        </h3>
                        <form onSubmit={handleAddRate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Item Name</label>
                                <input 
                                    type="text" 
                                    className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    placeholder="E.G., COTTON"
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value.toUpperCase())}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Rate (₹)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    placeholder="0.00"
                                    value={itemRate}
                                    onChange={(e) => setItemRate(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="sm:col-span-2 btn-primary flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> {isEditingForm ? "Update Rate" : "Add Rate"}
                            </button>
                        </form>
                    </div>

                    <div className="card !p-0 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">Current Rates</h4>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rateChart.map(r => (
                                <div key={r.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    {editingRateId === r.id ? (
                                        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mr-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Item Name</label>
                                                <input 
                                                    type="text" 
                                                    className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white py-1.5 px-3 text-sm font-bold"
                                                    value={editingItemName}
                                                    onChange={(e) => setEditingItemName(e.target.value.toUpperCase())}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Rate (₹)</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white py-1.5 px-3 text-sm font-bold"
                                                        value={editingItemRate}
                                                        onChange={(e) => setEditingItemRate(e.target.value)}
                                                        required
                                                    />
                                                    <div className="flex gap-1">
                                                        <button 
                                                            onClick={() => handleUpdateRate(r.id)}
                                                            className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 rounded-lg transition-colors flex items-center justify-center"
                                                            title="Save rate"
                                                        >
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={cancelEditing}
                                                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg transition-colors flex items-center justify-center"
                                                            title="Cancel"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-slate-100">{r.itemName}</p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Updated: {r.timestamp?.toDate().toLocaleDateString()}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-lg font-black text-emerald-600">₹{r.rate}</span>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => startEditing(r)} 
                                                        className="text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors p-1"
                                                        title="Edit Rate"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete('rateCharts', r.id)} 
                                                        className="text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 transition-colors p-1"
                                                        title="Delete Rate"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminPanel;