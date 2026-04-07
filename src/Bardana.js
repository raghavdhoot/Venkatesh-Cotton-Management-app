import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Plus, Trash2, X, Save, User } from 'lucide-react';

function Bardana({ currentUser }) {
    const [itemName, setItemName] = useState('');
    const [customItemName, setCustomItemName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [personName, setPersonName] = useState('');
    const [employeeName, setEmployeeName] = useState(currentUser?.name || '');
    const [type, setType] = useState('IN'); // IN or OUT
    const [bardanaEntries, setBardanaEntries] = useState([]);
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
        if (currentUser) {
            setEmployeeName(currentUser.name);
        }
    }, [currentUser]);

    useEffect(() => {
        const q = query(collection(db, 'bardanaEntries'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setBardanaEntries(entries);
        });
        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const finalItemName = itemName === 'OTHER' ? customItemName : itemName;
        if (!finalItemName || !quantity) return;

        const newEntry = {
            itemName: finalItemName,
            quantity: parseInt(quantity, 10),
            personName: personName || 'N/A',
            employeeName: employeeName || currentUser?.name || 'N/A',
            type,
            entryMaker: currentUser?.name || 'Unknown',
            timestamp: serverTimestamp()
        };

        try {
            await addDoc(collection(db, 'bardanaEntries'), newEntry);
            setItemName('');
            setQuantity('');
            setPersonName('');
            setEmployeeName(currentUser?.name || '');
            setIsFormOpen(false);
            setStatusMessage({ text: 'Entry added successfully', type: 'success' });
            setCustomItemName('');
        } catch (error) {
            console.error("Error adding bardana: ", error);
            setStatusMessage({ text: 'Error adding entry', type: 'error' });
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteDoc(doc(db, 'bardanaEntries', id));
            setDeleteConfirmId(null);
            setStatusMessage({ text: 'Entry deleted successfully', type: 'success' });
        } catch (error) {
            console.error("Error deleting bardana: ", error);
            setStatusMessage({ text: 'Error deleting entry', type: 'error' });
        }
    };

    const calculateStock = () => {
        const stock = {};
        bardanaEntries.forEach(entry => {
            if (!stock[entry.itemName]) stock[entry.itemName] = 0;
            if (entry.type === 'IN') {
                stock[entry.itemName] += entry.quantity;
            } else {
                stock[entry.itemName] -= entry.quantity;
            }
        });
        return stock;
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bardana Management</h2>
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
                        {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {isFormOpen ? 'Close Form' : 'New Bardana Entry'}
                    </button>
                </div>
            </div>

            {isFormOpen && (
                <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Item Name</label>
                            <select 
                                className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                value={itemName} 
                                onChange={(e) => setItemName(e.target.value)} 
                                required
                            >
                                <option value="">Select Item</option>
                                <option value="BARDANA">BARDANA (GUNNY BAGS)</option>
                                <option value="PLASTIC BARDANA">PLASTIC BARDANA</option>
                                <option value="SUTLI">SUTLI</option>
                                <option value="GATHAAN PATTI">GATHAAN PATTI</option>
                                <option value="GATHAN KAPDA">GATHAN KAPDA</option>
                                <option value="OTHER">OTHER</option>
                            </select>
                        </div>
                        {itemName === 'OTHER' && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-left-4">
                                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Specify Other Item</label>
                                <input 
                                    type="text" 
                                    className="input-field uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    value={customItemName}
                                    onChange={(e) => setCustomItemName(e.target.value.toUpperCase())} 
                                    required 
                                    placeholder="Enter Item Name"
                                />
                            </div>
                        )}
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Quantity</label>
                            <input 
                                type="number" 
                                className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                value={quantity} 
                                onChange={(e) => setQuantity(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                                {type === 'IN' ? 'Driver Name' : 'Given to'}
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                                <input 
                                    type="text" 
                                    className="input-field pl-10 uppercase dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                    value={personName} 
                                    onChange={(e) => setPersonName(e.target.value.toUpperCase())} 
                                    required 
                                    placeholder={type === 'IN' ? "e.g., Driver Name" : "e.g., Person Name"}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                                {type === 'IN' ? 'Received by (Employee)' : 'Given by (Employee)'}
                            </label>
                            <input 
                                type="text" 
                                className="input-field bg-slate-50 dark:bg-slate-800/50 uppercase dark:text-white" 
                                value={employeeName} 
                                onChange={(e) => setEmployeeName(e.target.value.toUpperCase())}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Type</label>
                            <select 
                                className="input-field dark:bg-slate-800 dark:border-slate-700 dark:text-white" 
                                value={type} 
                                onChange={(e) => setType(e.target.value)}
                            >
                                <option value="IN">Incoming (IN)</option>
                                <option value="OUT">Outgoing (OUT)</option>
                            </select>
                        </div>
                        <div className="md:col-span-3 flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button type="submit" className="btn-primary flex items-center gap-2">
                                <Save className="w-4 h-4" /> Save Entry
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Current Bardana Stock</h3>
                    <div className="space-y-3">
                        {Object.entries(calculateStock()).map(([item, qty]) => (
                            <div key={item} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 rounded-lg">
                                <span className="font-medium text-slate-700 dark:text-slate-300">{item}</span>
                                <span className={`font-bold ${qty < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {qty.toLocaleString()} Units
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card overflow-hidden !p-0">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Transactions</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="px-6 py-4 font-semibold">Item</th>
                                    <th className="px-6 py-4 font-semibold">Qty</th>
                                    <th className="px-6 py-4 font-semibold">Person</th>
                                    <th className="px-6 py-4 font-semibold">Employee</th>
                                    <th className="px-6 py-4 font-semibold">Type</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {bardanaEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">{entry.itemName}</td>
                                        <td className="px-6 py-4 text-sm font-bold">{entry.quantity}</td>
                                        <td className="px-6 py-4 text-sm">{entry.personName || 'N/A'}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-indigo-600 dark:text-indigo-400">{entry.employeeName || 'N/A'}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${entry.type === 'IN' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}>
                                                {entry.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {deleteConfirmId === entry.id ? (
                                                <div className="flex items-center justify-end gap-2 animate-in zoom-in-95 duration-200">
                                                    <button 
                                                        onClick={() => handleDelete(entry.id)}
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
                                                    onClick={() => setDeleteConfirmId(entry.id)}
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
        </div>
    );
}

export default Bardana;
