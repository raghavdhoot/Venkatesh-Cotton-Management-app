import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, query, orderBy, serverTimestamp, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Plus, Trash2, X, Save } from 'lucide-react';

function Bardana() {
    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [type, setType] = useState('IN'); // IN or OUT
    const [bardanaEntries, setBardanaEntries] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);

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
        if (!itemName || !quantity) return;

        const newEntry = {
            itemName,
            quantity: parseInt(quantity, 10),
            type,
            timestamp: serverTimestamp()
        };

        try {
            await addDoc(collection(db, 'bardanaEntries'), newEntry);
            setItemName('');
            setQuantity('');
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error adding bardana: ", error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Delete this entry?')) {
            try {
                await deleteDoc(doc(db, 'bardanaEntries', id));
                alert('Entry deleted successfully');
            } catch (error) {
                console.error("Error deleting bardana: ", error);
                alert('Error deleting entry');
            }
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
                <h2 className="text-2xl font-bold text-slate-900">Bardana Management</h2>
                <button 
                    onClick={() => setIsFormOpen(!isFormOpen)} 
                    className="btn-primary flex items-center gap-2"
                >
                    {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isFormOpen ? 'Close Form' : 'New Bardana Entry'}
                </button>
            </div>

            {isFormOpen && (
                <div className="card animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Item Name</label>
                            <input 
                                type="text" 
                                className="input-field" 
                                value={itemName} 
                                onChange={(e) => setItemName(e.target.value)} 
                                required 
                                placeholder="e.g., Gunny Bags"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Quantity</label>
                            <input 
                                type="number" 
                                className="input-field" 
                                value={quantity} 
                                onChange={(e) => setQuantity(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">Type</label>
                            <select 
                                className="input-field" 
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
                    <h3 className="text-lg font-semibold mb-4">Current Bardana Stock</h3>
                    <div className="space-y-3">
                        {Object.entries(calculateStock()).map(([item, qty]) => (
                            <div key={item} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg">
                                <span className="font-medium text-slate-700">{item}</span>
                                <span className={`font-bold ${qty < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {qty.toLocaleString()} Units
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card overflow-hidden !p-0">
                    <div className="p-4 border-b border-slate-100">
                        <h3 className="text-lg font-semibold">Recent Transactions</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                                    <th className="px-6 py-4 font-semibold">Item</th>
                                    <th className="px-6 py-4 font-semibold">Qty</th>
                                    <th className="px-6 py-4 font-semibold">Type</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bardanaEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{entry.itemName}</td>
                                        <td className="px-6 py-4 text-sm font-bold">{entry.quantity}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${entry.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {entry.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleDelete(entry.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 transition-colors"
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
        </div>
    );
}

export default Bardana;
